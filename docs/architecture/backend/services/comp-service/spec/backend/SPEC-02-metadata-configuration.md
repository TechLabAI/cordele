# SPEC-02 — Metadata Configuration & Cover (core orchestration)

**Module:** COMP · **Refs:** `contracts/api-contract.md` §4.1–§4.4, §7.1, `contracts/data-model.md` §2.1,
local `adr/ADR-003-cover-binary-storage-port.md`. EARS per
`docs/architecture/backend/standards/ears-notation.md`.

## Objetivo

Definir a configuração e persistência da identidade editorial (`Metadados`) de um projeto: campos
obrigatórios/opcionais, validação inline (T05), upload/remoção da capa via `FileStoragePort`, e a emissão
de `MetadataUpdated`. COMP nunca escreve `projeto_editorial` nem muda status.

## Escopo

- **In:** upsert idempotente de `Metadados` por `projetoId`; validação de `titulo`/`autor`/`idioma`; upload
  de capa (jpeg/png/webp ≤ 10 MB) atrás de `FileStoragePort`; remoção de capa; materialização lazy (D-M).
- **Out:** layout/overrides (SPEC-03); status (PROJ); registro real de ISBN/categoria (mock, sem API externa).

## Decisões técnicas

- **Upsert idempotente** keyed por `projetoId` (`UNIQUE(projeto_id)`); reenvio de corpo idêntico = no-op
  que devolve a representação atual.
- **Capa atrás de porta** (ADR-003 / D-L): o binário vai para `FileStoragePort`; a linha guarda apenas
  `capaUrl`. Substituir a capa reescreve o objeto e reaponta `capaUrl` (objeto anterior fica órfão → rotina
  de limpeza, R5). Capa é **opcional**.
- **Validação no domínio** (value objects): `Idioma` (`pt|en|es|fr`), `titulo`/`autor` não-vazios. Nenhum
  controller/adapter re-codifica a regra.
- **Sem status:** nenhuma operação de metadados toca `projeto_editorial` (ADR-002 boundary, R3).

## Implementação

- `UpdateMetadadosUseCase.upsert({ projetoId, titulo, autor, isbn?, idioma, categoria? })`: valida →
  carrega/cria `Metadados` (materializa se ausente) → persiste → emite `MetadataUpdated` pós-commit.
- `UploadCoverUseCase.upload({ projetoId, file })`: valida `contentType ∈ {image/jpeg,image/png,image/webp}`
  e `size ≤ 10 MB` **antes** de gravar → `FileStoragePort.put` → set `capaUrl` → materializa `Metadados` se
  ausente → emite `MetadataUpdated`.
- `RemoveCoverUseCase.remove({ projetoId })`: set `capaUrl=null` → agenda limpeza do objeto → emite evento.
- `editoraNome` é display denormalizado resolvido server-side (mock), nunca do corpo do cliente.

## Casos de borda

- `titulo`/`autor` em branco ou `idioma` fora do enum → 400, nada persiste.
- Upload > 10 MB → 413 (`cover-too-large`); tipo não suportado → 415 (`unsupported-cover-format`); nada grava.
- Upload de capa num projeto sem `Metadados` → materializa a linha e grava `capaUrl` na mesma request.
- Remoção de capa inexistente → 204 (idempotente).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL require titulo, autor and idioma; isbn, categoria and capa are optional.`
- `WHEN valid metadata is PUT, THE SYSTEM SHALL upsert Metadados keyed by projetoId, emit MetadataUpdated, and respond 200.`
- `IF idioma is not in {pt,en,es,fr} OR titulo/autor is blank, THEN THE SYSTEM SHALL respond 400 and persist nothing.`
- `WHEN a supported cover within 10 MB is uploaded, THE SYSTEM SHALL store it via FileStoragePort, set capaUrl, and respond 201.`
- `IF the cover exceeds 10 MB, THEN THE SYSTEM SHALL respond 413; IF its media type is not jpeg/png/webp, THEN 415.`
- `THE SYSTEM SHALL keep the cover binary out of the relational row (capaUrl reference only).`
- `THE SYSTEM SHALL NOT write projeto_editorial or change status on any metadata or cover operation.`
