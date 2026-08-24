"""cli_utils.py — shared CLI helpers for techlab-architecture scripts (D-085).

Centralizes small, cross-cutting utilities so every script in `scripts/`
behaves consistently at its CLI boundary. Sibling scripts import directly
(`from cli_utils import ...`) — Python adds the script's directory to
`sys.path` automatically when invoked as a top-level program.
"""

from __future__ import annotations

import sys


def force_utf8_stdio() -> None:
    """Reconfigure sys.stdout/sys.stderr to UTF-8 with replacement (D-084).

    Windows consoles default to cp1252; without this, any non-cp1252 character
    in printed output (em-dash, smart quotes, ↔, …) crashes with
    UnicodeEncodeError. `errors="replace"` keeps non-encodable characters
    visible as `?` in degraded environments instead of aborting.

    Safe to call multiple times. The try/except covers streams that don't
    expose `reconfigure` (test capture, exotic pipes) or that reject the
    reconfiguration (read-only file descriptors).
    """
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, OSError):
            pass


def require_positional_argv(
    argv: list[str],
    *,
    usage: str,
    doc: str | None = None,
    prog: str = "<script>",
) -> str:
    """Validate that argv[1] is a real positional argument, not a misplaced
    flag, then return it. Centralizes the guard pattern from D-086 (D-087).

    Behaviour:
      - argv missing argv[1] → prints "ERROR: argumento obrigatorio ausente"
        + usage to stderr; exits with code 1.
      - argv[1] in {"-h", "--help"} → prints `doc` (or `usage` as fallback)
        to stdout; exits with code 0.
      - argv[1] starts with "-" → prints "ERROR: flag-shaped argument" +
        usage to stderr; exits with code 1.
      - argv[1] is whitespace-only → prints "ERROR: empty positional" +
        usage; exits with code 1.
      - otherwise returns argv[1] as-is.

    This guard is for scripts that take exactly one required positional
    argument and accept zero flags (e.g. `be-file-guard.py <path>`,
    `be-scaffold.py <ISSUE_ID>`). Scripts with optional flags should use
    `argparse` instead.
    """
    if len(argv) < 2:
        print(f"ERROR: argumento obrigatorio ausente.\n{usage}", file=sys.stderr)
        sys.exit(1)

    raw = argv[1]
    if raw in {"-h", "--help"}:
        print((doc or usage).strip())
        sys.exit(0)
    if raw.startswith("-"):
        print(
            f"ERROR: argumento {raw!r} parece uma flag, mas {prog} "
            f"nao aceita flags.\n{usage}",
            file=sys.stderr,
        )
        sys.exit(1)
    if not raw.strip():
        print(f"ERROR: argumento posicional vazio.\n{usage}", file=sys.stderr)
        sys.exit(1)
    return raw
