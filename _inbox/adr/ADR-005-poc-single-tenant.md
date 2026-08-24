# ADR-005 — POC single-tenant — sem schema-per-empresa

> **Data:** 2026-06-20
> **Status:** accepted
> **Decisor:** Aécio Ribeiro (sponsor) + Danilo Amaral (arquiteto)

---

## Contexto

O framework techlab-architecture usa schema-per-empresa como padrão de multi-tenancy. O Cordelê tem apenas um cliente durante a POC (Editora Aetós). Implementar isolamento de schema aumentaria a complexidade sem benefício imediato. A arquitetura deve permitir migração para multi-tenant em v1 sem reescrita completa.

---

## Opções consideradas

### Opção 1 — Single-tenant na POC (escolhida)

- **Vantagens:**
  - Setup mais simples e rápido — foco na validação do fluxo editorial
  - Sem overhead de middleware de schema, migrations por tenant
  - Prazo da POC viável
- **Desvantagens:**
  - Dados da POC precisarão de migração quando segundo cliente entrar
  - Risco: segundo cliente durante a POC exige ADR de emergência — confirmado por Danilo Amaral (2026-08-20): único cliente (Editora Aetós) na POC; risco encerrado
- **Custo:** Baixo agora, médio na migração para v1

### Opção 2 — Schema-per-empresa desde o início (padrão techlab-architecture)

- **Vantagens:**
  - Zero migração ao escalar
  - Isolamento de dados garantido desde o primeiro dia
- **Desvantagens:**
  - Complexidade desnecessária na POC de único cliente
  - Overhead de desenvolvimento sem retorno na POC
- **Custo:** Alto para a POC — inviabiliza o prazo

---

## Decisão

Escolhida: **Single-tenant na POC. Identificar dados por editora_id em tabela única. Preparar abstração de tenant no ProjectRepository para migração futura.**.

---

## Justificativa

Único cliente na POC. Reduz complexidade e acelera validação. Risco de migração aceito pelo sponsor (constraint ORG-001).

---

## Trade-offs aceitos

- **Perdemos:** Padrão schema-per-empresa do techlab-architecture — porque: Aceito para viabilizar o prazo da POC. Migração planejada para v1.

---

## Como reverter se a decisão se mostrar errada

Migrar para schema-per-empresa em v1 exige: criar schema por editora, migrar dados existentes, atualizar middleware. Custo médio-alto, planejável.

---

## Sinais que indicariam que está errada

- Segundo cliente aprovado durante a POC — reabrir este ADR imediatamente
- Queries sem filtro de editora_id — risco de vazamento de dados entre tenants
- ProjectRepository sem abstração de tenant_context — migração para v1 custará reescrita da camada de dados

---

## Referências

- ORG-001 (constraint)
- Framing §10
- LBC §7.2
