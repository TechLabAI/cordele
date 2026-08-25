# SPEC-11 — Cross-Context Deletion & LGPD Erasure (closes G3)

**Module:** PROJ · **Refs:** `contracts/api-contract.md` §4.6, `contracts/data-model.md` §5,
`contracts/integration-contracts.md` §3, doc 05 *Data Lifecycle*, doc 06 R5/G3.
EARS per `docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Especificar a deleção de um `ProjetoEditorial` e a **erasure LGPD cross-context** — quem apaga o quê, em
que ordem, e por qual porta — dado que o projeto é a identidade a que IMP, COMP e PUB se ligam, e que os
binários/artefactos **não estão no DB**.

## Escopo

- **In:** `DeleteProjectUseCase`; a cascata orquestrada leaf-first sobre PUB/COMP/IMP (rows + storage);
  idempotência, ordem, aborto em falha; emissão de `ProjectDeleted`.
- **Out:** a mecânica interna de cada purge (é do contexto dono, atrás da sua `*ErasurePort`).

## Decisões técnicas (D-G)

- **PROJ é o ponto de entrada** da deleção; cada contexto **dono apaga os seus próprios dados** (rows +
  binários) atrás da sua porta de erasure.
- **Ordem leaf-first** (folhas antes da raiz), para que uma falha a meio deixe o projeto ainda existente
  (recuperável), nunca uma identidade órfã com storage pendente:
  1. `PublicationErasurePort.purge(projetoId)` — PUB: `Publicacao` rows **+** ePub/PDF em storage.
  2. `CompositionErasurePort.purge(projetoId)` — COMP: `Metadados`/`ConfiguracaoLayout` rows.
  3. `ManuscriptErasurePort.purge(projetoId)` — IMP: `manuscrito` rows **+** binários/imagens em storage.
  4. PROJ apaga `projeto_editorial` (e `projeto_status_historico` via FK cascade).
- **FK `ON DELETE CASCADE`** (declarada por IMP/COMP/PUB) é **backstop de integridade**, não o mecanismo de
  erasure — não apaga storage. A cascata orquestrada garante o storage; a FK garante que nenhuma row fica
  órfã mesmo se um contexto falhar em remover as suas.
- **Idempotência:** cada purge é no-op sobre dados já ausentes → `DELETE` reexecutado após falha parcial
  completa. **Aborto:** se qualquer purge falha, aborta antes de remover a identidade (502).
- **Tenant-scoped:** toda a cascata corre no `EmpresaContext` do chamador.

## Implementação

`DeleteProjectUseCase.delete({ projetoId })`:
```
1. carregar projeto (tenant-scoped); ausente → 404.
2. PublicationErasurePort.purge(projetoId)   # idempotente
3. CompositionErasurePort.purge(projetoId)   # idempotente
4. ManuscriptErasurePort.purge(projetoId)    # idempotente
5. apagar projeto_editorial (cascade → projeto_status_historico)
6. emitir ProjectDeleted (após commit)
   qualquer falha em 2–4 → abortar, 502 urn:cordele:proj:erasure-failed (nada removido em 5)
```

## Casos de borda

- Projeto sem manuscrito/publicação → purges são no-op; a identidade é removida na mesma.
- PUB fora do ar no passo 2 → aborto 502; projeto intacto; retry seguro (idempotente).
- Falha após passo 3 (COMP purgado, IMP não) → aborto; retry re-purga PUB/COMP (no-op) e completa IMP.
- Deleção concorrente → a segunda vê 404 após a primeira commitar.

## Critérios de aceite (EARS)

- `WHEN a project is deleted, THE SYSTEM SHALL purge PUB, then COMP, then IMP (rows and stored binaries),
  then delete projeto_editorial, then emit ProjectDeleted.`
- `THE SYSTEM SHALL treat each per-context purge as idempotent (purging absent data is a no-op).`
- `IF any purge fails, THEN THE SYSTEM SHALL abort before deleting projeto_editorial, leave the project
  recoverable, and respond 502 (urn:cordele:proj:erasure-failed).`
- `THE SYSTEM SHALL rely on FK ON DELETE CASCADE only as an integrity backstop, not as the storage-erasure
  mechanism.`
- `WHEN the manuscript is purged, THE SYSTEM SHALL ensure its stored binaries and images are removed.`
  (agreed with IMP — imp data-model §5, imp immutability feature).
- `THE SYSTEM SHALL run the entire cascade within the caller's EmpresaContext.`
