# SPEC-03 — Layout, Overrides & Read-only Preview (critical sub-feature)

**Module:** COMP · **Refs:** `contracts/api-contract.md` §4.5–§4.7, §7.2–§7.3, `contracts/data-model.md`
§2.2–§2.3, local `adr/ADR-002-layout-overrides-not-manuscript-mutation.md`, FE `adr/ADR-COMP-001`. EARS per
`docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir a configuração de layout (`ConfiguracaoLayout`), o modelo de overrides de alinhamento de imagem, e
o `preview-context` que o cliente renderiza — mantendo a promessa de imutabilidade do manuscrito
(ADR-002) e o split de fidelidade (preview é aproximação client-side; PUB é o render autoritativo,
FE ADR-COMP-001).

## Escopo

- **In:** upsert idempotente de `ConfiguracaoLayout` (tipografia/margens/headings dentro dos bounds §7.2);
  overrides `tipo=imagem` com `alinhamento` referenciando nós existentes do manuscrito; validação de
  `referenciaNo` via `ManuscriptContentPort` (read-only); `preview-context` (dados, não pixels).
- **Out:** mutação do manuscrito (proibida, ADR-002); blank-page inserts (`em-branco`, deferidos — D-H);
  render autoritativo do ePub (PUB); persistência de snapshot renderizado (FE ADR-COMP-001, rejeitado).

## Decisões técnicas

- **Superfície persistida (D-H):** parâmetros (`ConfiguracaoLayout`) + overrides de **alinhamento de
  imagem** apenas. `em-branco` está reservado no enum mas **rejeitado na escrita** no POC
  (`422 structural-edit-deferred`). Alinhamento de imagem é *parâmetro honrado pela PUB*, não edição de
  conteúdo — por isso fica no MVP; isto concilia BE ADR-002 (modelo de override) com FE ADR-COMP-001
  (`structuralEdits=false`).
- **Read-only do manuscrito (D-K):** `ManuscriptContentPort.getContentTree` (preview) e `nodeExists`
  (validação de override) são in-process, read-only; COMP nunca escreve dados do IMP.
- **Preview = dados (D-K):** `preview-context` devolve a árvore read-only + layout + overrides honrados;
  o cliente pagina e renderiza (aproximação). Nada renderizado é persistido nem devolvido como HTML/canvas.
- **Overrides stale (R2/G4):** na leitura, override cujo `referenciaNo` não resolve na árvore atual vem
  `stale=true` e é excluído do conjunto honrado (e do que a PUB recebe, D-I).

## Implementação

- `UpdateLayoutUseCase.upsert({ projetoId, tipografia..., overrides[] })`: valida bounds (§7.2, VOs) →
  para cada override valida `tipo=imagem`, `alinhamento` presente e `nodeExists(referenciaNo)` → rejeita
  `em-branco` (422) e `referenciaNo` inexistente (422) → upsert (`configuracao_layout` + `layout_override`)
  → emite `LayoutUpdated`.
- `GetLayoutPreviewUseCase.get({ projetoId })`: `getContentTree(projetoId)` → se `null`, 409
  (`manuscript-missing`) → compõe `PreviewContext` (§6.4 do api-contract) marcando overrides stale.
- Domínio: `ConfiguracaoLayout` VO impõe bounds e `h1≥h2≥h3`; `Alinhamento` VO restringe o enum.

## Casos de borda

- Valor de tipografia fora do bound → 400. `h1<h2` → 400.
- Override `tipo=em-branco` → 422 (`structural-edit-deferred`).
- Override para nó inexistente → 422 (`override-ref-not-found`).
- Preview sem manuscrito → 409. Re-import do manuscrito remove um nó → override vira `stale` na próxima leitura.
- Dois overrides para o mesmo `referenciaNo` → rejeitado (UNIQUE `uq_override_no`).

## Critérios de aceite (EARS)

- `WHEN a valid layout is PUT, THE SYSTEM SHALL upsert ConfiguracaoLayout and its image-alignment overrides, emit LayoutUpdated, and respond 200.`
- `IF an override has tipo=em-branco, THEN THE SYSTEM SHALL respond 422 (structural-edit-deferred).`
- `IF an override references a manuscript node absent from the current content tree, THEN THE SYSTEM SHALL respond 422 (override-ref-not-found) and persist nothing.`
- `THE SYSTEM SHALL read the manuscript content tree only through ManuscriptContentPort (read-only) and never mutate IMP data.`
- `WHEN the preview is requested, THE SYSTEM SHALL return the read-only content tree, layout and overrides as data for client-side rendering, never rendered output.`
- `THE SYSTEM SHALL mark overrides whose referenciaNo no longer resolves with stale=true and exclude them from the honoured set.`
- `THE SYSTEM SHALL expose in T06 only parameters PUB's stylesheet honours (api-contract §7.3).`
