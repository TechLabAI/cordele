# ADR-003 — ePub 3 como único formato de exportação no MVP

> **Data:** 2026-06-20
> **Status:** amended — ver ADR-008
> **Decisor:** Danielle Antunes (BA/PM) + Aécio Ribeiro (sponsor)

---

## Contexto

O Cordelê precisa definir quais formatos de saída suporta na POC. As principais plataformas de distribuição (Amazon KDP, Apple Books, Google Play Books) aceitam ePub 3. PDF e MOBI exigem motores de renderização distintos. Adicionar múltiplos formatos na POC fragmenta o esforço e a validação.

---

## Opções consideradas

### Opção 1 — ePub 3 apenas (escolhida)

- **Vantagens:**
  - Foco na qualidade do ePub — proposta de valor central
  - epubcheck valida ePub 3 — critério de aceite objetivo
  - Suportado por Amazon KDP, Apple Books, Google Play, Kobo
  - Menor escopo de desenvolvimento na POC
- **Desvantagens:**
  - Editoras que precisam de PDF para impressão sob demanda precisarão de outra ferramenta
- **Custo:** Baixo — decisão de escopo

### Opção 2 — ePub 3 + PDF

- **Vantagens:**
  - Cobre distribuição digital e impressão sob demanda
- **Desvantagens:**
  - Motor de PDF (Puppeteer) duplica a complexidade de rendering
  - Dois formatos a validar na POC — dobra o esforço de QA
- **Custo:** Alto — inviável na POC

---

## Decisão

Escolhida: **ePub 3 apenas no MVP/POC. PDF e MOBI candidatos a v1+ via ADR próprio.**.

---

## Justificativa

ePub 3 cobre as principais plataformas de distribuição digital. Foco em um único formato garante qualidade e permite validação objetiva via epubcheck. Constraint TECH-002 define ePub válido como critério central.

---

## Como reverter se a decisão se mostrar errada

Adicionar PDF em v1 é aditivo — não exige reescrita do pipeline ePub. Decisão reversível com custo médio.

---

## Sinais que indicariam que está errada

- Editora Aetós solicita PDF como critério de aceite da POC — reabrir ADR antes de iniciar desenvolvimento
- epubcheck retornando erros EPUB 2 como críticos — verificar se alvo é ePub 2 ou ePub 3

---

## Emenda — 2026-08-20

Sinal de risco materializado: Editora Aetós confirmou PDF como critério de aceite da POC (validado por Danilo Amaral, arquiteto). Decisão original de ePub 3 apenas foi superada. Ver **ADR-008** para a decisão de exportação dual ePub 3 + PDF via Puppeteer.

---

## Referências

- TECH-002 (constraint)
- LBC §6.2
- LBC §7.3
