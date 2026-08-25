# SPEC-03 — ePub Assembly & epubcheck Validation (sub-feature crítica)

**Module:** PUB · **Refs:** `contracts/integration-contracts.md` §2/§3,
`adr/ADR-003-epubcheck-validation-port.md`, imp api-contract §6.2 (ContentTree), comp api-contract §7.3
(honoured parameters).

## Objetivo

Especificar a montagem determinística de um pacote OCF/ePub 3 a partir da árvore de conteúdo do IMP e da
composição do COMP, e o mapeamento do veredito do epubcheck para `status`/`epubcheckStatus` (D-Q).

## Escopo

- **In:** `EpubBuilder` (domain service): OPF manifest + spine + nav (`nav.xhtml`) + documentos XHTML de
  conteúdo + CSS derivado do layout + empacotamento OCF (ZIP com `mimetype` primeiro, não-comprimido);
  `EpubValidationPort` e o mapeamento do veredito.
- **Out:** orquestração/estado (SPEC-02); rendering client-side de preview (isso é COMP/FE).

## Decisões técnicas

- **Fonte de conteúdo:** `ManuscriptContentPort.getContentTree` — a `estrutura` (capítulos → seções →
  blocos `paragraph`/`image`/`unparsed`) é percorrida em `order`. Texto de parágrafo é preservado verbatim
  (conteúdo é sacrossanto, IMP ADR-002); `runs`/`marks` viram spans inline. `image.storageKey` é lido via
  `FileStoragePort` e embarcado no OCF. `unparsed` é incluído como bloco preservado (nunca descartado).
- **Metadados → OPF:** `dc:title`=`titulo`, `dc:creator`=`autor`, `dc:language`=`idioma`,
  `dc:identifier` a partir de `isbn` quando presente (senão UUID urn); `capaUrl` vira o item de capa
  (`properties="cover-image"`).
- **Layout → CSS:** reproduz **exatamente** o conjunto honrado (comp §7.3): `fonteCorpoFamilia`,
  `fonteCorpoTamanho`, `espacamentoLinha`, `margemLateral`, `h1/h2/h3Tamanho`, e `alinhamento` por imagem
  (`tipo=imagem`). Nunca honra `em-branco` (deferido, D-H) nem snapshot renderizado. Sem layout → defaults
  documentados (comp §7.2).
- **Validação:** `EpubValidationPort.validate` roda epubcheck; o veredito é autoritativo (ADR-003).

**Mapeamento do veredito (D-Q):**

| Mensagens epubcheck | verdict | `epubcheckStatus` | `status` |
|---|---|---|---|
| nenhuma | — | `valido` | `publicado` |
| só warnings (0 errors) | — | `avisos` | `publicado` |
| ≥ 1 error/fatal | — | `erros_criticos` | `com_erros` |

## Implementação

- Determinismo: mesma entrada ⇒ mesmo pacote (ordenação estável de itens do manifest; sem timestamps
  voláteis no OCF além dos exigidos). Facilita testes e futura dedupe.
- `total_erros`/`total_avisos` derivados das `validation_message` (severity `error`/`warning`).
- Adapter epubcheck: child process do JAR; parse do relatório JSON → `ValidationReport`.

## Casos de borda

- Manuscrito com muitos `unparsed` → ePub ainda gera; qualidade é responsabilidade editorial (voltar a
  IMP/COMP), não bloqueio de publicação.
- Imagem ausente no storage (`storageKey` não resolve) → erro de montagem → `com_erros` com `resumo_erro`.
- epubcheck inexecutável (JRE/JAR ausente, crash) → `com_erros`; **nunca** publica artefato não validado
  (promessa central, doc 01).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL assemble the ePub deterministically from the read-only content tree, preserving
  paragraph text verbatim and including unparsed blocks.`
- `THE SYSTEM SHALL derive the ePub stylesheet only from the honoured layout parameters (comp §7.3), never
  honouring a stale or em-branco override.`
- `THE SYSTEM SHALL determine publicado vs com_erros solely from the epubcheck verdict (ADR-003).`
- `IF epubcheck reports only warnings, THEN THE SYSTEM SHALL publish with epubcheckStatus=avisos and a
  downloadable artifact.`
- `IF epubcheck cannot execute, THEN THE SYSTEM SHALL record com_erros and never publish an unvalidated
  artifact.`
