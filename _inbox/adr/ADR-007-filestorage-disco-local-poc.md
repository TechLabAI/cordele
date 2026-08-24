# ADR-007 — FileStorage — disco local na POC, object storage em v1

> **Data:** 2026-06-20
> **Status:** accepted
> **Decisor:** Danilo Amaral (arquiteto)

---

## Contexto

O Cordelê armazena binários em quatro pontos do fluxo: manuscritos originais (T03), imagens inseridas na edição de layout (T06 — toolbar adicionada na Fase 0.3), ePubs gerados (T07) e downloads históricos (T08). A estratégia de storage define custo de infra, latência e complexidade de backup.

---

## Opções consideradas

### Opção 1 — Disco local na POC + abstração via serviço (escolhida)

- **Vantagens:**
  - Zero custo adicional de infra na POC
  - Configuração imediata — sem credenciais de cloud
  - Abstração via FileStorage service permite troca transparente em v1
- **Desvantagens:**
  - Não escala horizontalmente — múltiplas instâncias do BFF não compartilham disco
  - Backup manual — sem versionamento nativo
- **Custo:** Baixo na POC

### Opção 2 — S3-compatible desde a POC (MinIO / AWS S3)

- **Vantagens:**
  - Escala horizontal imediata
  - Versionamento e backup nativos
- **Desvantagens:**
  - Custo e complexidade adicionais na POC sem retorno imediato
- **Custo:** Médio na POC — overhead sem retorno para único cliente

---

## Decisão

Escolhida: **Disco local com abstração via FileStorage service. Migrar para S3-compatible em v1 sem alterar a camada de domínio.**.

---

## Justificativa

POC de único cliente não justifica infraestrutura de object storage. Abstração via serviço garante que a migração em v1 seja transparente para os módulos IMP, COMP e PUB.

---

## Como reverter se a decisão se mostrar errada

Copiar arquivos para o bucket e atualizar a implementação do FileStorage service. Custo médio, planejável para v1.

---

## Sinais que indicariam que está errada

- FileStorage acoplado ao path de disco no código de domínio — abstração vazou
- Duas instâncias do BFF sem volume compartilhado — arquivos não encontrados intermitentemente
- Manuscritos sem path registrado no banco — dados órfãos irrecuperáveis

---

## Consequências

- T06 (inserção de imagem via toolbar) acessa FileStorage via BFF — documentado em Framing §6.9 e constraint TECH-004

---

## Referências

- Framing §6.9 FileStorage
- FIN-001 (constraint)
- TECH-004 (constraint)
