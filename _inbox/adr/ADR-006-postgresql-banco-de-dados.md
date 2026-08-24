# ADR-006 — PostgreSQL como banco de dados relacional

> **Data:** 2026-06-20
> **Status:** accepted
> **Decisor:** Danilo Amaral (arquiteto)

---

## Contexto

O Cordelê precisa persistir projetos editoriais, metadados, configurações de layout e histórico de publicações. O Framing §5 e §11.2 definem PostgreSQL. A escolha do banco define o ORM, os tipos de dados (JSONB para a árvore de conteúdo) e a estratégia de migração para v1 multi-tenant.

---

## Opções consideradas

### Opção 1 — PostgreSQL (escolhida)

- **Vantagens:**
  - Padrão do framework techlab-architecture para dados relacionais
  - JSONB nativo — armazena a árvore de conteúdo do manuscrito sem ORM complexo
  - Schema-per-empresa suportado nativamente para migração em v1
  - TypeORM e Prisma com suporte robusto
- **Desvantagens:**
  - Requer instância PostgreSQL no ambiente de POC (Docker ou serviço gerenciado)
- **Custo:** Baixo — commodity

### Opção 2 — SQLite apenas para POC

- **Vantagens:**
  - Zero configuração de servidor — arquivo local
- **Desvantagens:**
  - Migração para PostgreSQL em v1 exige reescrita de migrations
  - JSONB não disponível — árvore de conteúdo em TEXT
  - Schema-per-empresa não suportado nativamente
- **Custo:** Baixo agora, alto na migração

---

## Decisão

Escolhida: **PostgreSQL desde a POC. Usar JSONB para armazenar Manuscrito.estrutura.**.

---

## Justificativa

PostgreSQL alinha com o padrão do framework e suporta nativamente a migração para schema-per-empresa em v1. JSONB elimina tabelas adicionais para a árvore de conteúdo.

---

## Como reverter se a decisão se mostrar errada

Migrar para outro banco relacional após dados em produção — custo alto. Decisão praticamente irreversível pós-POC.

---

## Sinais que indicariam que está errada

- Queries JSONB sem índice em produção — degradação de performance em bibliotecas grandes
- Migrations sem controle de versão — impossível rastrear estado do schema
- Conexões sem pool configurado — esgotamento de conexões sob carga

---

## Referências

- Framing §5
- Framing §11.2
- ADR-005
