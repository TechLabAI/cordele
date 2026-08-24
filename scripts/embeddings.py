"""embeddings.py — pluggable embedding provider for the specs corpus (D-432 phase 2).

Stdlib only (urllib). Default provider is **Ollama** (local, zero egress); OpenAI
is available behind `TECHLAB_EMBED_PROVIDER=openai` (sends text to api.openai.com —
external egress, requires authorization).

Used by:
  - architecture-specs-index.py --embed  → embeds spec chunks into pgVector
    (framework_chunk_embeddings) via the runtime's _write_chunks.
  - pipeline-context.py spec-context --semantic → embeds the query for vector search.

Config (env):
  TECHLAB_EMBED_PROVIDER  ollama (default) | openai
  TECHLAB_EMBED_MODEL     default nomic-embed-text (ollama) — must match the
                          pgVector vector() dimension below
  TECHLAB_EMBED_DIMS      default 768 (nomic) — keep in sync with init.sql
  OLLAMA_HOST             default http://localhost:11434
  OPENAI_API_KEY          required when provider=openai

Model-specific instruction prefixes are applied automatically (nomic / mxbai),
which matter more for retrieval quality than the vector dimension.
"""
from __future__ import annotations

import json
import os
import urllib.request

PROVIDER = os.environ.get("TECHLAB_EMBED_PROVIDER", "ollama").lower()
MODEL = os.environ.get("TECHLAB_EMBED_MODEL",
                       "nomic-embed-text" if PROVIDER == "ollama" else "text-embedding-3-small")
DIMS = int(os.environ.get("TECHLAB_EMBED_DIMS", "768" if PROVIDER == "ollama" else "1536"))
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
_BATCH = 64


def _prefix(texts: list[str], kind: str) -> list[str]:
    """Apply the model's instruction prefix. kind = 'document' | 'query'.
    nomic uses `search_document:` / `search_query:`; mxbai prepends a query prompt
    only to queries; others pass through."""
    m = MODEL.lower()
    if m.startswith("nomic"):
        return [f"search_{kind}: {t}" for t in texts]
    if m.startswith("mxbai") and kind == "query":
        return ["Represent this sentence for searching relevant passages: " + t for t in texts]
    return texts


def _post(url: str, body: dict, headers: dict, timeout: int = 120) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), method="POST")
    for k, v in headers.items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _ollama_embed(texts: list[str]) -> list[list[float]]:
    out: list[list[float]] = []
    for i in range(0, len(texts), _BATCH):
        resp = _post(f"{OLLAMA_HOST}/api/embed",
                     {"model": MODEL, "input": texts[i:i + _BATCH]},
                     {"Content-Type": "application/json"})
        out.extend(resp.get("embeddings", []))
    return out


def _openai_embed(texts: list[str]) -> list[list[float]]:
    key = os.environ["OPENAI_API_KEY"]
    out: list[list[float]] = []
    for i in range(0, len(texts), _BATCH):
        resp = _post("https://api.openai.com/v1/embeddings",
                     {"model": MODEL, "input": texts[i:i + _BATCH]},
                     {"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        out.extend(d["embedding"] for d in resp["data"])
    return out


def _embed(texts: list[str], kind: str) -> list[list[float]]:
    prepared = _prefix(texts, kind)
    return _openai_embed(prepared) if PROVIDER == "openai" else _ollama_embed(prepared)


def _available() -> bool:
    if PROVIDER == "openai":
        return bool(os.environ.get("OPENAI_API_KEY"))
    return True  # ollama: assume local daemon; embed() fails fast if not


def embed_query(text: str) -> list[float] | None:
    """Embed one query; None on failure (best-effort → caller falls back to lexical)."""
    if not _available():
        return None
    try:
        return _embed([text], "query")[0]
    except Exception:
        return None


def embed_query_batch(texts: list[str]) -> list[list[float] | None]:
    """Embed many texts in batched calls (best-effort). Returns a list aligned
    with `texts`; all-None if the batch failed. Same `query` prefix as embed_query,
    so vectors stay consistent with already-indexed docs. Much faster for bulk
    indexing than calling embed_query per doc (one HTTP round-trip per 64 texts)."""
    if not _available() or not texts:
        return [None] * len(texts)
    try:
        vecs = _embed(texts, "query")
        return list(vecs) if len(vecs) == len(texts) else [None] * len(texts)
    except Exception:
        return [None] * len(texts)


def make_provider():
    """Async EmbeddingProvider for the runtime's pg_indexer._write_chunks
    (model_name, dimensions, async embed_batch over DOCUMENTS), or None."""
    if not _available():
        return None

    class _Provider:
        model_name = MODEL
        dimensions = DIMS

        async def embed(self, text: str) -> list[float]:
            import asyncio
            return (await asyncio.to_thread(_embed, [text], "document"))[0]

        async def embed_batch(self, texts: list[str]) -> list[list[float]]:
            import asyncio
            return await asyncio.to_thread(_embed, texts, "document")

    return _Provider()
