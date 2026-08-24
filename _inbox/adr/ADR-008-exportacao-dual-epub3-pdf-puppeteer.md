# ADR-008 — Exportação dual ePub 3 + PDF via Puppeteer

> **Data:** 2026-08-20
> **Status:** accepted
> **Decisor:** Danilo Amaral (arquiteto)
> **Substitui:** ADR-003 (amended)

---

## Contexto

O ADR-003 havia restringido a exportação ao ePub 3 apenas na POC, adiando PDF para v1+. Durante a revisão de ADRs em 2026-08-20, o arquiteto confirmou que a Editora Aetós exige **ambos os formatos como critério de aceite da POC**. O sinal de risco documentado no ADR-003 se materializou.

A escolha do motor de PDF precisa ser compatível com a base de renderização já planejada para o ePub — reutilizar a mesma pipeline HTML reduz a duplicação de lógica de layout.

---

## Opções consideradas

### Opção 1 — Puppeteer (HTML → PDF) — mesma base do ePub (escolhida)

- **Vantagens:**
  - Reutiliza o mesmo HTML de renderização do ePub — zero duplicação de lógica de layout
  - PDF fiel ao visual do ePub — consistência de saída para o cliente
  - Puppeteer já amplamente usado em Node.js/NestJS — sem nova dependência de linguagem
  - Integração simples no BFF: `page.pdf()` sobre o HTML gerado
- **Desvantagens:**
  - Puppeteer sobe uma instância Chromium — overhead de memória no servidor (~200MB)
  - PDF gerado é page-based — paginação automática pode não respeitar quebras editoriais complexas sem CSS `@page` configurado
  - Tempo de geração maior que ePub para manuscritos longos
- **Custo:** Médio — Chromium no container Docker aumenta tamanho da imagem

### Opção 2 — pdfkit / PDFMake (PDF nativo sem browser)

- **Vantagens:**
  - Sem overhead de Chromium — menor uso de memória
  - Controle granular de layout
- **Desvantagens:**
  - Layout implementado separadamente do ePub — duplicação de lógica editorial
  - APIs imperativas — maior esforço para replicar fidelidade visual
- **Custo:** Alto — duplicação de pipeline de rendering

---

## Decisão

Escolhida: **Puppeteer (HTML → PDF), compartilhando a mesma base de renderização do ePub 3.**

---

## Justificativa

Reutilizar o HTML de renderização do ePub elimina duplicação de lógica de layout. O custo de memória do Chromium é aceitável na POC de único cliente. A imagem Docker já inclui JVM (ADR-004) — adicionar Chromium ao container é planejável.

---

## Trade-offs aceitos

- **Perdemos:** Ausência de Chromium no container — porque: overhead de memória aceito para evitar pipeline dupla de layout editorial.
- **Atenção:** CSS `@page` precisa ser configurado para quebras de página editorialmente corretas. Sem isso, PDF pode paginar no meio de capítulos.

---

## Como reverter se a decisão se mostrar errada

Substituir Puppeteer por pdfkit/PDFMake é possível sem afetar a pipeline do ePub. Custo médio — reimplementação do layout em API imperativa.

---

## Sinais que indicariam que está errada

- Chromium excedendo memória disponível no container sob carga — considerar geração assíncrona com fila
- PDF com quebras de página incorretas em manuscritos longos — CSS `@page` não configurado
- Tempo de geração > 30s para manuscritos normais — otimização de renderização necessária

---

## Consequências

- Pipeline de exportação do BFF: `ManuscriptRenderer → HTML → [epubgen, Puppeteer]` — dois consumidores do mesmo HTML
- Dockerfile atualizado: adicionar `puppeteer` + dependências Chromium à imagem base com JVM
- ExportService no NestJS expõe endpoint unificado com parâmetro `format: 'epub' | 'pdf' | 'both'`

---

## Referências

- ADR-003 (amended — decisão original superada por este ADR)
- ADR-004 (Docker com JVM embutida)
- ADR-002 (BFF Node.js/NestJS)
- TECH-002 (constraint — ePub válido como critério de aceite; estende-se ao PDF)
