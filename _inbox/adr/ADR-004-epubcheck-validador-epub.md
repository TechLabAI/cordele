# ADR-004 — epubcheck (W3C EPUB Checker) como validador de ePub

> **Data:** 2026-06-20
> **Status:** accepted
> **Decisor:** Danilo Amaral (arquiteto)

---

## Contexto

O Cordelê precisa validar os arquivos .epub gerados antes de liberá-los para download. A validação é critério de aceite central da POC (constraint TECH-002 e princípio UX 2.3). O epubcheck é a ferramenta oficial do W3C usada pelas plataformas de distribuição como Amazon KDP e Apple Books.

---

## Opções consideradas

### Opção 1 — epubcheck W3C EPUB Checker (escolhida)

- **Vantagens:**
  - Ferramenta oficial do W3C — mesma usada por Amazon KDP e Apple Books
  - Open source, ativamente mantido
  - Disponível como CLI Java (child_process) ou wrapper npm
  - Saída estruturada com severidade por erro — fácil de parsear
- **Desvantagens:**
  - Requer JVM no servidor Node.js — resolvido: imagem Docker com JVM embutida (confirmado por Danilo Amaral, 2026-08-20)
  - Tempo de execução perceptível para ePubs grandes (> 500 páginas)
- **Custo:** Baixo — gratuito, configuração simples

### Opção 2 — Validação customizada sem epubcheck

- **Vantagens:**
  - Sem dependência de JVM
- **Desvantagens:**
  - Validação nunca tão completa quanto o epubcheck
  - Amazon KDP pode rejeitar ePub que passou na validação customizada
- **Custo:** Alto — desenvolvimento contínuo de regras sem garantia de cobertura

---

## Decisão

Escolhida: **epubcheck via wrapper Node.js (child_process ou pacote npm epubcheck)**.

---

## Justificativa

Ferramenta de referência do W3C e das plataformas de distribuição. Credibilidade da validação depende de usar a mesma ferramenta que as plataformas usam.

---

## Como reverter se a decisão se mostrar errada

Substituição por outra ferramenta é possível — epubcheck é invocado via EpubValidator que pode ser reimplementado. Custo médio.

---

## Sinais que indicariam que está errada

- JVM não disponível no ambiente de deploy — epubcheck não executa
- Timeout para manuscritos grandes — implementar timeout com fallback de aviso ao usuário
- Versão do epubcheck desatualizada — erros diferentes dos que a Amazon KDP usa como referência

---

## Referências

- TECH-002 (constraint)
- Framing §2.2
- Framing §6.7 EpubValidator
- Framing §8.2
