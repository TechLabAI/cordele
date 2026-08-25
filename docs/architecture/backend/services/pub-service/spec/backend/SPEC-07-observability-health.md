# SPEC-07 — Observability & Health

**Module:** PUB · **Refs:** doc 02 §Cross-cutting (Observability), `contracts/api-contract.md` §3,
`contracts/integration-contracts.md` §3.

## Objetivo

Especificar logs estruturados, eventos de pipeline, métricas de build/validação e health/readiness,
correlacionados por `trace_id`/`X-Correlation-Id`.

## Escopo

- **In:** correlação; diagnósticos de build (duração, veredito, contagem de mensagens) first-class;
  health/readiness incluindo epubcheck e storage.
- **Out:** dashboards; alerting (operação).

## Decisões técnicas

- `X-Correlation-Id` propagado (gerado se ausente) para logs e eventos; refletido na resposta e carregado
  para o job assíncrono.
- Diagnósticos de build logados por publicação: `projetoId`, `publicacaoId`, `sequencia`, duração de
  montagem/validação, `epubcheckStatus`, `totalErros`/`totalAvisos`.
- Health via endpoint padrão do NestJS (`/health` no monólito): DB, storage e **disponibilidade do
  epubcheck** (JRE/JAR) como dependências de readiness.

## Implementação

- Interceptor de correlação no `PubController`; logger estruturado (JSON) com `empresa`, `correlationId`,
  `publicacaoId`.
- Emitir evento de pipeline por fase do build (start/end de `gerando`/`validando`/terminal) com `trace_id`
  (padrão D-423 da plataforma).
- Readiness falha se DB/storage indisponíveis; readiness **degradada/DOWN** se epubcheck não puder executar
  (senão builds falhariam silenciosamente — SPEC-03/integration §3.1).

## Casos de borda

- Build longo (livro grande) → registrar duração; sem timeout artificial (roda no job, não no request).
- Falha de `advanceTo` → logar `status-advance-failed` com `traceId`; build result preservado.
- epubcheck indisponível → readiness sinaliza; builds resultam `com_erros` explicitamente (nunca publica).

## Critérios de aceite (EARS)

- `THE SYSTEM SHALL attach a correlationId to every request and to the build job, generating one when
  absent, and return it in the response.`
- `WHEN a build reaches a terminal state, THE SYSTEM SHALL log build diagnostics (durations, verdict,
  message counts) correlated by trace_id.`
- `WHILE the database, file storage or epubcheck is unavailable, THE SYSTEM SHALL report readiness as DOWN
  (or degraded for epubcheck).`
- `IF advanceTo fails, THEN THE SYSTEM SHALL log status-advance-failed carrying the traceId without losing
  the build result.`
