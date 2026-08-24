"""es_mappings.py — canonical ES mapping loader (D-424).

Single source of truth for every Elasticsearch index mapping is
``techlab-infra/elasticsearch/*.json``. Scripts load the canonical JSON from
there; the embedded Python dict each script carries is a *fallback* used only
when the infra clone is unreachable (preserves the zero-infra / offline-CI
contract, R3 — emitting must never hard-depend on a sibling repo being present).

A CI parity check (tests/smoke_mapping_parity.py) asserts that each embedded
dict equals its canonical JSON, so the fallback can never silently drift.

Infra elasticsearch dir resolution order:
  1. ``TECHLAB_INFRA_HOME`` env  → ``<TECHLAB_INFRA_HOME>/elasticsearch``
  2. sibling clone              → ``../techlab-infra/elasticsearch`` relative to
     this workspace (walk up from this file)
"""
from __future__ import annotations

import json
import os
from pathlib import Path


def infra_es_dir() -> Path | None:
    """Resolve the canonical techlab-infra/elasticsearch directory, or None."""
    env = os.environ.get("TECHLAB_INFRA_HOME")
    if env:
        d = Path(env) / "elasticsearch"
        if d.is_dir():
            return d
    # Walk up from this file; at each level look for a techlab-infra sibling.
    here = Path(__file__).resolve()
    for level in here.parents:
        cand = level.parent / "techlab-infra" / "elasticsearch"
        if cand.is_dir():
            return cand
    return None


def load_mapping(filename: str, embedded: dict) -> dict:
    """Return the canonical mapping from infra JSON, or `embedded` if the infra
    clone (or the specific file) is unavailable/unreadable. Never raises."""
    d = infra_es_dir()
    if d:
        f = d / filename
        if f.is_file():
            try:
                return json.loads(f.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
    return embedded
