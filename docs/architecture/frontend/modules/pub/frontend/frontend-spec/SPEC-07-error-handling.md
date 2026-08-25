# SPEC-07 — Error Handling — PUB (Publicação) — Frontend

> BE returns RFC-7807 `application/problem+json`; the `ErrorNormalize` interceptor in
> `@cordele/shared/access-http-base` converts it to a normalized `AppError`
> (`{ type, title, status, detail, traceId }`). The `type` URN is the stable switch key. Every failure
> code below is taken from `api-contract.md` §5 — the FE does not invent codes.

## 1. `ProblemDetail` → `AppError` → user feedback

`AppError` is keyed on the URN `type`. The FE maps each to a channel (inline / toast / banner / modal)
and a pt-BR message. `traceId` (mirrors `X-Correlation-Id`) is attached to every rendered error for
support/observability. On a build failure, `Publicacao.resumoErro` + the correlation id are shown.

> **Verdict is not an error (critical):** a successful export that yields `erros_criticos` is a
> **200** response whose `epubcheckStatus` drives the **red result banner + blocked download** — it is
> **domain data**, never an HTTP error toast. Only transport/authorization/pre-flight failures are
> `AppError`s.

## 2. Failure-code table (authoritative, from api-contract §5)

| BE `type` (URN) | HTTP | Screen | Channel | pt-BR message |
|---|---|---|---|---|
| `urn:cordele:pub:manuscript-missing` | 409 | T07 | banner (progress card) | "Este projeto ainda não tem um manuscrito importado. Importe o conteúdo (IMP) antes de exportar." |
| `urn:cordele:pub:metadata-incomplete` | 422 | T07 | banner (progress card) | "Faltam metadados obrigatórios (título, autor, idioma). Complete a composição (COMP) e tente de novo." |
| `urn:cordele:pub:artifact-not-available` | 409 | T07/T08 | inline (download) | "Este arquivo não está disponível para download (a publicação tem erros críticos ou ainda está em processamento)." |
| `urn:cordele:pub:status-advance-failed` | 502 | T07 | banner | "O ePub foi gerado, mas o status do projeto não pôde ser atualizado. O resultado foi salvo; tente novamente ou contate o suporte (traceId)." |
| `urn:cordele:pub:projeto-not-found` | 404 | T07/T08 | banner | "Projeto não encontrado nesta empresa." (pre-empted by `pubProjetoGuard`) |
| `urn:cordele:pub:publicacao-not-found` | 404 | T07/T08 | banner | "Publicação não encontrada nesta empresa." (bad id / cross-tenant) |
| `urn:cordele:pub:validation` | 400 | T07 | inline (form) | "Requisição inválida. Recarregue a página e tente novamente." |
| `urn:cordele:pub:unauthorized` | 401 | any | (interceptor) redirect to login | — (handled globally by the Access Layer) |
| `urn:cordele:pub:forbidden` | 403 | any | modal / 403 page | "Você não tem permissão para esta ação." |
| *download URL expired* (`401`/`404` on the signed URL) | — | T08 | inline (row) | "O link de download expirou. Gerando um novo link…" (auto re-fetch, SPEC-04 §4) |
| *network / 5xx* | 5xx | T07/T08 | banner + retry | "Falha temporária. Tente novamente em instantes." (no phantom "gerando" that never resolves) |

## 3. Channel criteria (toast vs banner vs modal vs inline)

- **Banner (progress card):** an in-flight export failed at the pre-flight or transport level (409
  manuscript-missing, 422 metadata-incomplete, 502 status-advance-failed, 404, timeout, 5xx). Shown on
  the T07 progress/result card with a **"Tentar novamente"** affordance (re-reads status or, before any
  record exists, re-triggers).
- **Inline (download control / form):** a download-scoped failure the editor sees on the affordance
  itself (409 artifact-not-available on a blocked row, expired signed URL re-fetch, 400 validation).
- **Modal:** blocking authorization failure (403).
- **Toast:** transient, non-blocking feedback (e.g. a successful re-fetch of an expired download link).

## 4. Retry strategy

- **Export trigger is not auto-retried** — re-triggering could start a redundant build (the server's
  idempotency, D-R, protects against a genuine double, but the FE still surfaces retry **explicitly**
  via "Tentar novamente"). Retry after a terminal read re-reads status; it does **not** blindly re-POST.
- **Status poll** honours `Retry-After` with a bounded ceiling; on exhaustion it shows an honest
  timeout state (retry re-reads, never re-triggers a second build).
- **Signed download URL** auto re-fetches **once** on expiry/`401`/`404` (§4.4 is idempotent — a fresh
  TTL is expected), then falls back to an inline error; it never degrades to a public link.
- **401** is handled globally (token refresh / re-login) by the Access Layer, not by PUB.
- Every error carries the interceptor `traceId`/correlation id.

## Criterios de aceite (EARS)

- `IF the backend responds urn:cordele:pub:manuscript-missing, THEN THE SYSTEM SHALL show a banner on the export card directing the editor to import a manuscript and SHALL NOT navigate to a result [pub-err-manuscript-missing].`
- `IF the backend responds urn:cordele:pub:metadata-incomplete, THEN THE SYSTEM SHALL show a banner directing the editor to complete required metadata in composition [pub-err-metadata-incomplete].`
- `IF the backend responds urn:cordele:pub:artifact-not-available, THEN THE SYSTEM SHALL show an inline download error and SHALL NOT expose an enabled download [pub-err-artifact-not-available].`
- `IF the backend responds urn:cordele:pub:status-advance-failed, THEN THE SYSTEM SHALL show a banner stating the ePub was generated but the project status update failed, preserving the correlation traceId [pub-err-status-advance-failed].`
- `IF the backend responds urn:cordele:pub:publicacao-not-found, THEN THE SYSTEM SHALL show a not-found banner and SHALL NOT render a partial result [pub-err-publicacao-not-found].`
- `IF the backend responds urn:cordele:pub:forbidden, THEN THE SYSTEM SHALL show a blocking permission message and SHALL NOT retry [pub-err-forbidden].`
- `WHEN a successful export response carries epubcheckStatus erros_criticos, THE SYSTEM SHALL render the red result banner with the download blocked and SHALL NOT surface it as an HTTP error toast [pub-err-verdict-not-error].`
- `IF an export request fails with a network error or 5xx before a publication exists, THEN THE SYSTEM SHALL show a retryable banner and SHALL NOT display a phantom gerando state [pub-err-network-retry].`
- `WHEN any PUB request fails, THE SYSTEM SHALL attach the correlation traceId to the rendered error [pub-err-trace-id].`
