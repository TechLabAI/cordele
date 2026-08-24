# ADR-002 — BFF em Node.js / NestJS — desvio do padrão Java do framework

> **Data:** 2026-06-20
> **Status:** accepted
> **Decisor:** Aécio Ribeiro (sponsor) + Danilo Amaral (arquiteto)

---

## Contexto

O framework techlab-architecture usa Java/Spring Boot como backend padrão. O Cordelê é produto standalone. O sponsor definiu Node.js/NestJS como BFF (constraint TECH-001). O ecossistema Node.js tem bibliotecas maduras para parsing de DOCX (mammoth.js) e Markdown (remark) sem equivalentes Java tão simples.

---

## Opções consideradas

### Opção 1 — Node.js / NestJS (escolhida)

- **Vantagens:**
  - mammoth.js e remark — libs Node.js maduras para parsing editorial
  - TypeScript compartilhado com o frontend — interfaces sem duplicação
  - NestJS tem estrutura modular e injeção de dependência similar ao Spring
  - Deploy mais simples na POC sem JVM
- **Desvantagens:**
  - Desvio do padrão Java do framework — equipe Java precisará de adaptação
  - Node.js single-threaded — parsing de DOCXs grandes pode bloquear event loop sem streams assíncronas
- **Custo:** Médio — requer experiência Node.js/NestJS no time

### Opção 2 — Java / Spring Boot (padrão techlab-architecture)

- **Vantagens:**
  - Padrão do framework — reaproveitamento de boilerplate
  - Spring Security maduro
- **Desvantagens:**
  - Apache POI para DOCX é mais verboso que mammoth.js
  - Dois contextos de linguagem — interfaces duplicadas ou geração de código
- **Custo:** Alto — parsing DOCX mais complexo + duas linguagens

---

## Decisão

Escolhida: **Node.js / NestJS**.

---

## Justificativa

Decisão pré-Estágio 0 do sponsor. Libs Node.js para parsing editorial (mammoth.js, remark) superam o custo de desviar do padrão Java. Desvio documentado como exceção ao framework.

---

## Trade-offs aceitos

- **Perdemos:** Padronização com o framework techlab-architecture — porque: Aceito: o Cordelê é produto standalone; benefício das libs Node.js para parsing supera o custo de desviar do padrão Java.

---

## Como reverter se a decisão se mostrar errada

Reescrever o BFF em Java/Spring — viável em v1 mas exige reescrita completa dos serviços de parsing. Inviável na POC.

---

## Sinais que indicariam que está errada

- Parsing de DOCX grande bloqueando o event loop — streams assíncronas não implementadas
- Sem testes de integração no BFF — regressão silenciosa no pipeline de exportação
- Ausência de validação de entrada no BFF — superfície de ataque para uploads maliciosos

---

## Referências

- TECH-001 (constraint)
- Framing §2.3
- Framing §6.2 ManuscriptParser
