# Runbook: Reconciliação de Build Órfão (PUB-020)

## 1. Cenário de risco

Um crash do processo `pub-service` durante o build de um ePub — por OOM, restart do pod,
SIGKILL ou falha de infraestrutura — deixa a linha `Publicacao` presa nos status
`gerando` ou `validando` indefinidamente.

O índice parcial `uq_publicacao_projeto_inflight` (criado em PUB-007) garante unicidade de
publicações em voo por projeto: enquanto a linha órfã existir em status `gerando` ou
`validando`, todos os novos exports do mesmo projeto falham com conflito de índice (D-R).
O projeto fica bloqueado até que o operador intervenha manualmente.

No MVP não existe timeout automático (SPEC-05 §assunção pós-POC). Este runbook cobre o
procedimento de identificação e correção manual.

## 2. Critério de identificação

Query de diagnóstico — executar conectado ao banco de dados do ambiente afetado.
O operador deve especificar o schema correto (`emp_aetos` no MVP):

```sql
SET search_path = emp_aetos;

SELECT id, projeto_id, status, iniciada_em
FROM publicacao
WHERE status IN ('gerando', 'validando')
  AND iniciada_em < now() - INTERVAL '1 hour';
```

Limiar padrão: **1 hora** (configurável via `PUB_ORPHAN_TIMEOUT_MINUTES`).

Resultado não-vazio confirma um ou mais builds órfãos. Anote os valores de `id` e
`projeto_id` antes de prosseguir — serão usados na verificação pós-correção.

Alternativa via script (requer `DATABASE_URL` e `ts-node`/`tsx`):

```bash
DATABASE_URL="postgresql://..." \
  npx tsx backend/services/pub-service/scripts/pub-reconcile-orphans.ts \
  --dry-run \
  --schema emp_aetos \
  --timeout-minutes 60
```

O `--dry-run` imprime a tabela de órfãos sem modificar nenhuma linha.

## 3. Passos de correção

**Passo 1 — Confirmar lista de órfãos em dry-run:**

```bash
DATABASE_URL="postgresql://..." \
  npx tsx backend/services/pub-service/scripts/pub-reconcile-orphans.ts \
  --dry-run \
  --schema emp_aetos \
  --timeout-minutes 60
```

Revise a saída tabulada (`publicacaoId`, `projetoId`, `status`, `iniciadaEm`).
Confirme que todas as linhas listadas são realmente órfãs (não há build legítimo
em andamento iniciado há menos de 1 hora).

**Passo 2 — Executar reconciliação (sem `--dry-run`):**

```bash
DATABASE_URL="postgresql://..." \
  npx tsx backend/services/pub-service/scripts/pub-reconcile-orphans.ts \
  --schema emp_aetos \
  --timeout-minutes 60
```

O script marca cada linha com `status = com_erros` e
`resumo_erro = 'Reconciled: process crash'`, liberando o índice parcial para novos
exports.

**Passo 3 — Verificar liberação do índice (ver Seção 4).**

**Passo 4 — Informar o editor para tentar novo export via UI.**

O projeto está desbloqueado; o editor pode iniciar um novo export normalmente pela
interface web do Cordelê.

## 4. Verificação da liberação do índice

Após a execução do script, re-executar a query de diagnóstico e confirmar 0 linhas:

```sql
SET search_path = emp_aetos;

SELECT id, projeto_id, status, iniciada_em
FROM publicacao
WHERE status IN ('gerando', 'validando')
  AND iniciada_em < now() - INTERVAL '1 hour';
-- deve retornar 0 linhas
```

Confirmar também que o índice parcial não bloqueia novo export para o projeto afetado:

```sql
SELECT id, status, iniciada_em
FROM publicacao
WHERE projeto_id = '<projetoId>'
  AND status IN ('gerando', 'validando');
-- deve retornar 0 linhas
```

Se o resultado for 0 linhas em ambas as queries, o projeto está desbloqueado e o
operador pode confirmar ao editor que o export pode ser retentado.

## 5. Quando escalar

Escalar para o time de plataforma nos seguintes casos:

- A query de diagnóstico (Seção 2) retorna linhas **após** a execução do script sem
  `--dry-run` — a reconciliação não surtiu efeito.
- Novas publicações continuam ficando presas em `gerando`/`validando` após a correção,
  sugerindo um problema recorrente no processo de build (loop de crash, falta de memória
  persistente, dependência externa indisponível).
- O script retorna erro ao tentar atualizar as linhas (permissão negada, deadlock,
  constraint violation inesperada).
- Mais de 3 projetos diferentes apresentam builds órfãos simultaneamente — pode indicar
  falha de infraestrutura sistêmica (restart do pod em produção, falha de disco/memória).

Ao escalar, fornecer:
1. Saída completa do `--dry-run` (lista de linhas afetadas).
2. Saída completa da execução sem `--dry-run` (count de linhas afetadas e mensagem de erro, se houver).
3. Logs do `pub-service` no intervalo `iniciadaEm` → detecção (para identificar o ponto de crash).
