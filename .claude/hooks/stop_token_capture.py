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
    "pending_input":    <accumulated since last emit, consumed by next emit>,
    "pending_output":   <idem>,
    "watermark_input":  <transcript total at time of last Stop firing>,
    "watermark_output": <idem>
  }

Best-effort: any failure exits 0 — never blocks the session.
"""
import json
import sys
from pathlib import Path

TRACE_DIR        = ".techlab"
TOKEN_DELTA_FILE = "token-delta.json"


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


def _read_delta_file(project_cwd: str) -> dict:
    f = Path(project_cwd) / TRACE_DIR / TOKEN_DELTA_FILE
    if f.is_file():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"pending_input": 0, "pending_output": 0,
            "watermark_input": 0, "watermark_output": 0}


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
    project_cwd     = payload.get("cwd", "")

    if not transcript_path or not project_cwd:
        sys.exit(0)

    # Current cumulative total in the transcript
    curr_in, curr_out = _parse_transcript_tokens(transcript_path)
    if curr_in == 0 and curr_out == 0:
        sys.exit(0)

    # Delta since previous Stop firing
    state = _read_delta_file(project_cwd)
    wm_in  = state.get("watermark_input",  0)
    wm_out = state.get("watermark_output", 0)
    new_in  = curr_in  - wm_in
    new_out = curr_out - wm_out

    if new_in <= 0 and new_out <= 0:
        sys.exit(0)  # no new tokens this turn

    # Accumulate into pending (may span multiple turns before next emit)
    state["pending_input"]   = state.get("pending_input",  0) + new_in
    state["pending_output"]  = state.get("pending_output", 0) + new_out
    state["watermark_input"]  = curr_in
    state["watermark_output"] = curr_out

    try:
        _write_delta_file(project_cwd, state)
    except Exception:
        pass

    sys.exit(0)


if __name__ == "__main__":
    main()
