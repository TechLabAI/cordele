# pub-service — Local Setup

## Prerequisites

### Java Runtime Environment (JRE 11+)

`pub-service` uses [epubcheck](https://github.com/w3c/epubcheck) to validate
generated ePub 3 packages before publication (ADR-003). epubcheck requires
**JRE 11 or later** on the system `PATH`.

Verify your JRE installation:

```bash
java -version
# Expected: openjdk 11.x.x or higher
```

### epubcheck JAR

Download the latest release from:
<https://github.com/w3c/epubcheck/releases>

Extract and set the path in `.env.local`:

```env
EPUBCHECK_JAR_PATH=/path/to/epubcheck/epubcheck.jar
```

Example (macOS/Linux):

```bash
curl -L https://github.com/w3c/epubcheck/releases/latest/download/epubcheck.zip -o /tmp/epubcheck.zip
unzip /tmp/epubcheck.zip -d /opt/epubcheck
echo "EPUBCHECK_JAR_PATH=/opt/epubcheck/epubcheck-5.x.x/epubcheck.jar" >> .env.local
```

### Health check behavior

When `EPUBCHECK_JAR_PATH` is **not set**:

- The health endpoint (`GET /health`) reports `DOWN` for the epubcheck indicator.
- Any ePub generation will result in `status=com_erros` (never published unvalidated — ADR-003).
- Unit tests and integration tests using mock ports are unaffected.

### Running without epubcheck (stub mode)

Set `PUB_USE_STUBS=true` in `.env.local` to bypass real IMP/COMP/PROJ calls.
The epubcheck adapter still runs (or fails gracefully) — epubcheck is not
stubbed by `PUB_USE_STUBS`, only the cross-context ports are.

To skip epubcheck validation in tests, mock `EpubValidationPort` in Jest.

## Storage

Set `PUB_STORAGE_ROOT` to a writable local directory:

```env
PUB_STORAGE_ROOT=/var/pub-service/storage
```

The directory is created automatically on first `put()`. Artifacts are stored as:

```
$PUB_STORAGE_ROOT/emp_<slug>/publicacoes/<publicacaoId>/output.epub
```

## Environment variables summary

| Variable                       | Required | Default              | Description                              |
|-------------------------------|----------|----------------------|------------------------------------------|
| `EPUBCHECK_JAR_PATH`          | No       | —                    | Path to epubcheck JAR; health DOWN if absent |
| `PUB_STORAGE_ROOT`            | No       | `.pub-storage/` (cwd) | Base directory for artifact storage      |
| `PUB_DOWNLOAD_URL_TTL_SECONDS`| No       | `900`                | Signed-URL TTL in seconds                |
| `PUB_SIGN_SECRET`             | Yes (prod)| random              | HMAC key for signed download URLs        |
| `PUB_USE_STUBS`               | No       | `false`              | Use stub adapters for IMP/COMP/PROJ      |
| `PUB_MANUSCRIPT_STUB_NULL`    | No       | `false`              | Stub returns null for manuscript (409 path) |
| `PUB_METADADOS_STUB_NULL`     | No       | `false`              | Stub returns null for metadados (422 path) |
