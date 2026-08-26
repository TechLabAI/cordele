#!/usr/bin/env python
"""
Claude Code Stop hook — accumulate per-turn token deltas for per-gate attribution.

Fires at the end of every agent turn. Reads the session transcript JSONL,
computes the delta since the last firing, and accumulates it in
.techlab/token-delta.json.  pipeline_events.py emit auto-reads and resets
that file, so each gate event (VALIDATOR-VALIDATION, PLANNER, IMPLEMENTER,
…) carries the tokens spent in the preceding work phase (D-462, Option A).

Structure of .techlab/token-delta.json:
  {
    "pending_input":  <accumulated since last emit, consumed by next emit>,
    "pending_output": <idem>,
    "watermarks": {
      "<transcript key>": {"input": <total>, "output": <total>, "seq": <n>}
    },
    "seq": <monotonic counter used to prune the watermark map>
  }

The watermark is keyed BY TRANSCRIPT, not global. Totals are read from a
per-session transcript, so a single global watermark carries the previous
session's total into the next session: the new session's smaller total yields a
negative delta, the guard below discards it, and the hook silently records
nothing until the new session outgrows the old one. Keying by transcript is what
makes the delta meaningful across concurrent and successive sessions.

An unseen transcript starts at watermark 0, so a brand-new session's first turn
is counted in full. (One-time artifact when migrating off the old global format:
the in-flight session's backlog lands in the next emit.)

Best-effort: any failure exits 0 — never blocks the session.
"""
import json
import os
import sys
from pathlib import Path

TRACE_DIR        = ".techlab"
TOKEN_DELTA_FILE = "token-delta.json"
MAX_WATERMARKS   = 50   # bound the per-session watermark map


def _parse_transcript_tokens(path: str) -> tuple[int, int]:
    """Return (input_tokens, output_tokens) summed across unique API calls.

    The CC transcript stores multiple entries per API call (streaming chunks).
    Deduplicate by message.id so each call is counted exactly once.
    cache_read_input_tokens count toward billed input.
    """
    input_total = output_total = 0
    seen_message_ids: set[str] = set()
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if entry.get("type") != "assistant":
                    continue
                msg = entry.get("message")
                if not isinstance(msg, dict):
                    continue
                msg_id = msg.get("id")
                if msg_id:
                    if msg_id in seen_message_ids:
                        continue
                    seen_message_ids.add(msg_id)
                usage = msg.get("usage")
                if not isinstance(usage, dict):
                    continue
                input_total  += usage.get("input_tokens", 0)
                input_total  += usage.get("cache_read_input_tokens", 0)
                output_total += usage.get("output_tokens", 0)
    except Exception:
        pass
    return input_total, output_total


def _project_root(payload_cwd: str) -> str:
    """Project root, immune to cwd drift into a sub-package (D-609).

    The Stop payload's `cwd` is the session's *current* directory, which moves
    when the work happens inside a service folder (backend/services/<svc>/).
    `.techlab/token-delta.json` must always land at the project root, because
    that is where `pipeline_events.py emit` reads and resets it.
    """
    env_root = (os.environ.get("CLAUDE_PROJECT_DIR") or "").strip()
    if env_root and Path(env_root).is_dir():
        return env_root
    try:
        start = Path(payload_cwd).resolve()
    except Exception:
        return payload_cwd
    for candidate in (start, *start.parents):
        if (candidate / "project-context.json").is_file():
            return str(candidate)
        if (candidate / ".claude" / "hooks").is_dir():
            return str(candidate)
    return payload_cwd


def _transcript_key(transcript_path: str) -> str:
    """Stable per-session key: the transcript filename stem (the session id)."""
    try:
        stem = Path(transcript_path).stem
        if stem:
            return stem
    except Exception:
        pass
    return transcript_path


def _read_delta_file(project_cwd: str) -> dict:
    f = Path(project_cwd) / TRACE_DIR / TOKEN_DELTA_FILE
    state = {"pending_input": 0, "pending_output": 0, "watermarks": {}, "seq": 0}
    if f.is_file():
        try:
            loaded = json.loads(f.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                state.update(loaded)
        except Exception:
            pass
    if not isinstance(state.get("watermarks"), dict):
        state["watermarks"] = {}
    # Migrate off the legacy global watermark: it cannot be attributed to a
    # transcript, so it is dropped rather than misapplied to an unrelated session.
    state.pop("watermark_input", None)
    state.pop("watermark_output", None)
    return state


def _prune_watermarks(watermarks: dict, keep: int = MAX_WATERMARKS) -> dict:
    """Keep only the `keep` most recently touched sessions, so the map is bounded."""
    if len(watermarks) <= keep:
        return watermarks
    ordered = sorted(
        watermarks.items(),
        key=lambda kv: kv[1].get("seq", 0) if isinstance(kv[1], dict) else 0,
        reverse=True,
    )
    return dict(ordered[:keep])


def _write_delta_file(project_cwd: str, data: dict) -> None:
    d = Path(project_cwd) / TRACE_DIR
    d.mkdir(parents=True, exist_ok=True)
    f = d / TOKEN_DELTA_FILE
    tmp = f.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(f)


def main() -> None:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
    except Exception:
        sys.exit(0)

    transcript_path = payload.get("transcript_path", "")
    project_cwd     = _project_root(payload.get("cwd", ""))

    if not transcript_path or not project_cwd:
        sys.exit(0)

    # Current cumulative total in the transcript
    curr_in, curr_out = _parse_transcript_tokens(transcript_path)
    if curr_in == 0 and curr_out == 0:
        sys.exit(0)

    # Delta since this transcript's previous Stop firing.
    state = _read_delta_file(project_cwd)
    key   = _transcript_key(transcript_path)
    prev  = state["watermarks"].get(key)
    if not isinstance(prev, dict):
        prev = {}
    wm_in  = prev.get("input",  0)
    wm_out = prev.get("output", 0)

    # Clamp each component independently: a transcript that was rewritten or
    # truncated can move one counter backwards while the other advances, and a
    # single combined guard would let the negative one corrupt `pending`.
    new_in  = max(0, curr_in  - wm_in)
    new_out = max(0, curr_out - wm_out)

    if new_in == 0 and new_out == 0:
        sys.exit(0)  # no new tokens this turn

    # Accumulate into pending (may span multiple turns before next emit)
    state["pending_input"]  = state.get("pending_input",  0) + new_in
    state["pending_output"] = state.get("pending_output", 0) + new_out

    seq = int(state.get("seq", 0)) + 1
    state["seq"] = seq
    state["watermarks"][key] = {"input": curr_in, "output": curr_out, "seq": seq}
    state["watermarks"] = _prune_watermarks(state["watermarks"])

    try:
        _write_delta_file(project_cwd, state)
    except Exception:
        pass

    sys.exit(0)


if __name__ == "__main__":
    main()
