#!/usr/bin/env python3
"""gate-comment-budget.py — gate da politica de comentario (D-580).

O codigo e autoexplicavel: o *o que* e o *como* vivem no codigo. O *porque*
(decisao, invariante, armadilha) vive na camada recuperavel — `D-NNN` no doc de
consolidacao, ADR, `api-contract.md` — e no codigo aparece no maximo como
ponteiro de uma linha. Este gate impoe isso de forma deterministica, porque a
mesma regra posta num prompt degrada em duas fases.

Quatro regras (D-580):

    densidade    comentario > 35% das linhas nao-vazias do ficheiro.
                 O teto e 35% e nao 10%: a medicao que originou o D-580 mostra
                 que ~87% da prosa carrega sinal nao-derivavel do codigo
                 ("valida que pertence ao tenant do contexto"). 10% cortaria
                 sinal e reprovaria o repositorio inteiro.
    reafirmacao  `// Arrange` / `// Act` / `// Assert` / `// Given|When|Then`
                 nus e banners de seccao (`// ---- helpers ----`). Zero sinal.
    todo-nu      TODO/FIXME/XXX/HACK sem rastreio. Rastreavel = `TODO[TAG]`,
                 um `D-NNN`, ou referencia a issue/plano/doc. Sem isto nao ha
                 como distinguir divida de scaffold de nota de alguem — no
                 candeeiro-so eram 1484 `// TODO: implement step` a passar por
                 codigo pronto.
    eco (WARN)   comentario cuja unica informacao ja esta na linha seguinte.
                 Heuristico, por isso avisa e nao reprova (`--strict` promove).

Ambito por omissao = **o diff**, nao a arvore. O D-580 e prospetivo: nao exige
remediacao retroativa dos sitios existentes. Em modo diff a densidade so se
aplica a ficheiros novos (o autor de uma linha nova nao responde pela densidade
herdada); as restantes regras aplicam-se as linhas adicionadas.

Uso:
    gate-comment-budget.py check                       # diff da worktree
    gate-comment-budget.py check --base origin/main    # diff contra uma ref
    gate-comment-budget.py check --all                 # arvore inteira
    gate-comment-budget.py report --all --json         # densidade por balde
    gate-comment-budget.py check --all --output report.md

Exit codes (R3): 0 sem violacoes | 1 erro de uso | 2 violacoes encontradas.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from cli_utils import force_utf8_stdio
except ImportError:  # o gate tem de correr mesmo solto (R3: stdlib-only)
    def force_utf8_stdio() -> None:
        for stream in (sys.stdout, sys.stderr):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
            except (AttributeError, ValueError):
                pass


MAX_DENSITY = 0.35
MIN_LINES = 30  # abaixo disto a densidade e ruido estatistico

# Sintaxe de comentario por extensao. "line-block" = `//` + `/* */`.
LANGS = {
    ".java": "line-block", ".kt": "line-block", ".kts": "line-block",
    ".ts": "line-block", ".tsx": "line-block", ".js": "line-block",
    ".jsx": "line-block", ".mts": "line-block", ".cts": "line-block",
    ".scss": "block", ".css": "block",
    ".py": "hash",
    ".html": "html",
}

EXCLUDE_DIRS = {
    "node_modules", "build", "dist", ".git", ".gradle", ".nx", ".angular",
    "coverage", "playwright-report", "test-results", "out", "bin", "tmp",
    "__pycache__", ".venv", "venv", "target", "design-reference",
}

# `design-reference/` fica de fora: e o prototipo clonado do BA, nao codigo que
# este pipeline escreve.

# Um TODO rastreavel aponta para algo: uma tag, uma decisao, uma issue, um doc.
TRACEABLE = re.compile(
    r"""(?xi)
    TODO\[[^\]]+\] | FIXME\[[^\]]+\]      # TODO[SCAFFOLD], FIXME[PAY-012]
    | \bD-\d{3}\b                          # ponteiro de decisao
    | \bissue\b | \bplan-\S+                # see issue X / plan-PAY-001.md
    | \b\d{2}[a-z]?-[a-z][a-z-]+\b          # see 02b-be-logic
    | \S+\.(?:md|puml|ya?ml)\b              # see api-contract.md
    """
)
# Ancorado no INICIO do comentario: `// TODO: x` e uma anotacao, mas
# `# skeleton has TODO` e prosa SOBRE anotacoes. Sem a ancora, uma frase que
# mencione a palavra reprovava o build.
TODO_MARK = re.compile(r"^\s*[-*]?\s*(TODO|FIXME|XXX|HACK)\b")

_LEAD = r"^\s*(?://+|/\*+|\*+/?|#+|<!--)\s*"
# `// Arrange`, `// Act:`, `// Given` — rotulo nu, sem o facto que o justifica.
BARE_LABEL = re.compile(
    _LEAD + r"(arrange|act|assert|given|when|then|setup|teardown)\s*[:.\-]?\s*(\*/|-->)?\s*$",
    re.IGNORECASE,
)
# `// ---- helpers ----`, `// ===== GETTERS =====`, `// ***`
SECTION_BANNER = re.compile(_LEAD + r"[=\-~*#_]{3,}")
SECTION_BANNER_WRAPPED = re.compile(_LEAD + r"[=\-~*#_]{2,}[^=\-~*#_]*[=\-~*#_]{2,}\s*$")

WORD = re.compile(r"[A-Za-z]{3,}")
CAMEL_SPLIT = re.compile(r"(?<!^)(?=[A-Z])")
STOPWORDS = {
    "the", "and", "for", "from", "with", "that", "this", "into", "com", "para",
    "dos", "das", "que", "por", "uma", "este", "esta", "esse", "não", "nao",
}


@dataclass
class Violation:
    file: str
    line: int
    rule: str
    detail: str
    severity: str = "FAIL"


@dataclass
class FileStats:
    code: int = 0
    comment: int = 0
    blank: int = 0
    comments: list[tuple[int, str]] = field(default_factory=list)

    @property
    def density(self) -> float:
        total = self.code + self.comment
        return self.comment / total if total else 0.0


def _scan_python(text: str) -> FileStats | None:
    """Comentarios de Python pelo tokenizer, nao por prefixo de linha.

    Varios scripts embutem modelos Markdown em strings triplas, e um heading
    (`### Prioridades`) comeca por `#` como um comentario comeca. Contados como
    comentario, inflavam a densidade e disparavam regras sobre texto que nem
    codigo e -- `doc-scaffold.py` reprovava por dois `{TODO}` que sao
    marcadores de um plano gerado. O tokenizer sabe distinguir; um prefixo nao.

    Devolve None se o ficheiro nao tokeniza (sintaxe partida), para o chamador
    cair no scanner por prefixo em vez de perder o ficheiro.
    """
    import io
    import tokenize

    st = FileStats()
    comment_lines: set[int] = set()
    try:
        for tok in tokenize.generate_tokens(io.StringIO(text).readline):
            if tok.type == tokenize.COMMENT:
                comment_lines.add(tok.start[0])
                st.comments.append((tok.start[0], tok.line.strip()))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        return None

    for no, raw in enumerate(text.splitlines(), start=1):
        if not raw.strip():
            st.blank += 1
        elif no in comment_lines:
            st.comment += 1
        else:
            st.code += 1
    return st


def scan(text: str, kind: str) -> FileStats:
    """Conta linhas e devolve (numero, texto) de cada linha de comentario."""
    if kind == "hash":
        tokenized = _scan_python(text)
        if tokenized is not None:
            return tokenized
    st = FileStats()
    in_block = False
    closer = "*/"
    for no, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if in_block:
            st.comment += 1
            st.comments.append((no, line))
            if closer in line:
                in_block = False
            continue
        if not line:
            st.blank += 1
            continue
        opener = None
        if kind in ("line-block", "block") and line.startswith("/*"):
            opener, closer = "/*", "*/"
        elif kind == "html" and line.startswith("<!--"):
            opener, closer = "<!--", "-->"
        if opener:
            st.comment += 1
            st.comments.append((no, line))
            if closer not in line[len(opener):]:
                in_block = True
            continue
        if (kind == "line-block" and line.startswith("//")) or \
           (kind == "hash" and line.startswith("#")):
            st.comment += 1
            st.comments.append((no, line))
            continue
        st.code += 1
    return st


def strip_marker(s: str) -> str:
    return re.sub(r"^\s*(?://+|/\*+|\*+/?|#+|<!--|-->)\s*", "", s).replace("*/", "").strip()


def _next_code_line(lines: list[str], idx: int, comment_lines: set[int]) -> str:
    """Primeira linha de CODIGO depois de `idx` (numero de linha 1-based).

    Salta vazias E comentarios. Sem saltar comentarios, um bloco de prosa
    acusava-se a si proprio: a "linha seguinte" de um comentario e quase sempre
    outro comentario, e duas linhas de razao consecutiva partilham vocabulario.
    Era um falso positivo sobre exatamente o que o D-580 quer preservar --
    o porque nao-derivavel.
    """
    for j in range(idx, min(idx + 10, len(lines))):
        if not lines[j].strip():
            continue
        if (j + 1) in comment_lines:
            continue
        return lines[j]
    return ""


def check_file(path: Path, rel: str, added: set[int] | None,
               apply_density: bool, max_density: float) -> tuple[FileStats | None, list[Violation]]:
    kind = LANGS.get(path.suffix.lower())
    if not kind:
        return None, []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return None, [Violation(rel, 0, "io", str(exc))]

    st = scan(text, kind)
    if st.code + st.comment == 0:
        return st, []

    lines = text.splitlines()
    comment_lines = {no for no, _ in st.comments}
    out: list[Violation] = []

    if apply_density and st.code + st.comment >= MIN_LINES and st.density > max_density:
        out.append(Violation(
            rel, 1, "densidade",
            f"{st.density:.0%} de comentario (teto {max_density:.0%}; "
            f"{st.comment} coment. / {st.code} codigo) — mova o porque para o RAG",
        ))

    for no, raw in st.comments:
        if added is not None and no not in added:
            continue
        body = strip_marker(raw)
        if not body:
            continue

        if TODO_MARK.search(body) and not TRACEABLE.search(body):
            out.append(Violation(
                rel, no, "todo-nu",
                f"{body[:60]!r} — sem rastreio; use TODO[TAG], D-NNN ou 'see issue X'",
            ))
            continue

        if BARE_LABEL.match(raw):
            out.append(Violation(
                rel, no, "reafirmacao", f"{body[:60]!r} — rotulo nu, o codigo ja diz"))
            continue

        if SECTION_BANNER.match(raw) or SECTION_BANNER_WRAPPED.match(raw):
            out.append(Violation(
                rel, no, "reafirmacao", f"{body[:60]!r} — banner de seccao"))
            continue

        nxt = _next_code_line(lines, no, comment_lines)
        # `<pre>`, `</p>`: markup de Javadoc nao e prosa, nao pode ecoar nada.
        prose = re.sub(r"</?[a-z][a-z0-9]*\s*/?>", " ", body, flags=re.IGNORECASE)
        if nxt and WORD.search(prose):
            c = {w.lower() for w in WORD.findall(prose)} - STOPWORDS
            n = {w.lower() for w in WORD.findall(CAMEL_SPLIT.sub(" ", nxt))}
            # `c & n` obrigatorio: sem uma palavra em comum nao ha eco a provar.
            # Sem isso, um comentario que se reduz a UMA palavra de conteudo
            # passava sempre -- a tolerancia de 1 divergencia engolia a
            # comparacao inteira e acusava prosa sem relacao com o codigo.
            if c and (c & n) and len(c - n) <= max(1, len(c) // 4):
                out.append(Violation(
                    rel, no, "eco", f"{body[:60]!r} — repete a linha seguinte", "WARN"))
    return st, out



def _git(root: Path, *args: str) -> str:
    try:
        res = subprocess.run(["git", "-C", str(root), *args],
                             capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        raise RuntimeError(f"git {' '.join(args)}: {exc}") from exc
    return res.stdout


_HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def changed_files(root: Path, base: str | None) -> dict[str, tuple[set[int], bool]]:
    """rel -> (linhas adicionadas, e_ficheiro_novo). base=None -> worktree vs HEAD."""
    rng = [base] if base else []
    names = _git(root, "diff", "--name-status", "--diff-filter=ACMR", *rng)
    new_files: set[str] = set()
    wanted: set[str] = set()
    for line in names.splitlines():
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        status, rel = parts[0], parts[-1]
        if Path(rel).suffix.lower() not in LANGS:
            continue
        wanted.add(rel)
        if status.startswith("A"):
            new_files.add(rel)

    # untracked conta como ficheiro novo
    for rel in _git(root, "ls-files", "--others", "--exclude-standard").splitlines():
        if rel and Path(rel).suffix.lower() in LANGS:
            wanted.add(rel)
            new_files.add(rel)

    out: dict[str, tuple[set[int], bool]] = {r: (set(), r in new_files) for r in wanted}
    if wanted:
        diff = _git(root, "diff", "-U0", *rng, "--", *sorted(wanted))
        cur, ln = None, 0
        for line in diff.splitlines():
            if line.startswith("+++ b/"):
                cur, ln = line[6:], 0
            elif line.startswith("@@"):
                m = _HUNK.match(line)
                if m:
                    ln = int(m.group(1))
            elif line.startswith("+") and not line.startswith("+++") and cur in out:
                out[cur][0].add(ln)
                ln += 1
    for rel in new_files:
        p = root / rel
        if p.is_file():
            try:
                n = len(p.read_text(encoding="utf-8", errors="replace").splitlines())
                out[rel] = (set(range(1, n + 1)), True)
            except OSError:
                pass
    return out


def walk(root: Path) -> list[str]:
    rels: list[str] = []
    for path in root.rglob("*"):
        if not path.is_file() or EXCLUDE_DIRS & set(path.parts):
            continue
        if path.suffix.lower() in LANGS:
            rels.append(str(path.relative_to(root)).replace("\\", "/"))
    return rels



def bucket_of(rel: str) -> str:
    p = "/" + rel.replace("\\", "/")
    if "/backend/" in p or p.startswith("/backend"):
        return "backend-test" if "/src/test/" in p else "backend-main"
    if "/frontend/" in p or p.startswith("/frontend"):
        if re.search(r"\.(spec|test)\.[tj]sx?$", p):
            return "frontend-spec"
        return "frontend-src"
    if "/scripts/" in p or p.startswith("/scripts"):
        return "scripts"
    return "other"



_ICON = {"FAIL": "[FAIL]", "WARN": "[WARN]", "OK": "[ OK ]"}


def render_violations(vs: list[Violation]) -> str:
    if not vs:
        return "Nenhuma violacao.\n"
    lines = ["| Sev | Regra | Local | Detalhe |", "|---|---|---|---|"]
    for v in vs:
        lines.append(f"| {_ICON[v.severity]} | {v.rule} | `{v.file}:{v.line}` | {v.detail} |")
    return "\n".join(lines) + "\n"


def render_report(stats: dict[str, FileStats]) -> str:
    agg: dict[str, dict[str, int]] = defaultdict(lambda: {"files": 0, "code": 0, "comment": 0})
    for rel, st in stats.items():
        b = agg[bucket_of(rel)]
        b["files"] += 1
        b["code"] += st.code
        b["comment"] += st.comment
    lines = ["| Balde | Ficheiros | Codigo | Comentario | Densidade |", "|---|---:|---:|---:|---:|"]
    tc = tk = 0
    for name, b in sorted(agg.items(), key=lambda kv: -(kv[1]["comment"] / max(1, kv[1]["comment"] + kv[1]["code"]))):
        total = b["comment"] + b["code"]
        tc += b["comment"]
        tk += total
        lines.append(f"| {name} | {b['files']} | {b['code']:,} | {b['comment']:,} | "
                     f"{b['comment'] / max(1, total):.1%} |")
    lines.append(f"| **total** | {sum(v['files'] for v in agg.values())} | | {tc:,} | "
                 f"{tc / max(1, tk):.1%} |")
    return "\n".join(lines) + "\n"



def run(args: argparse.Namespace) -> tuple[list[Violation], dict[str, FileStats], int]:
    root = args.path.resolve()
    if not root.is_dir():
        print(f"error: {root} nao e um diretorio", file=sys.stderr)
        return [], {}, 1

    if args.all:
        targets = {rel: (None, True) for rel in walk(root)}
    else:
        try:
            targets = {rel: (added, is_new)
                       for rel, (added, is_new) in changed_files(root, args.base).items()}
        except RuntimeError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return [], {}, 1
        if not targets:
            return [], {}, 0

    violations: list[Violation] = []
    stats: dict[str, FileStats] = {}
    for rel, (added, is_new) in sorted(targets.items()):
        p = root / rel
        if not p.is_file() or EXCLUDE_DIRS & set(Path(rel).parts):
            continue
        st, vs = check_file(p, rel, added, apply_density=is_new, max_density=args.max_density)
        if st is not None:
            stats[rel] = st
        violations.extend(vs)

    if args.strict:
        for v in violations:
            v.severity = "FAIL"
    fails = [v for v in violations if v.severity == "FAIL"]
    return violations, stats, (2 if fails else 0)


def main(argv: list[str] | None = None) -> int:
    force_utf8_stdio()
    ap = argparse.ArgumentParser(description="Gate da politica de comentario (D-580)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, helptxt in (("check", "reprova violacoes"), ("report", "so densidade por balde")):
        sp = sub.add_parser(name, help=helptxt)
        sp.add_argument("--path", type=Path, default=Path(os.environ.get("PROJECT_ROOT", ".")),
                        help="raiz do projeto (default: PROJECT_ROOT ou cwd)")
        sp.add_argument("--all", action="store_true", help="arvore inteira em vez do diff")
        sp.add_argument("--base", default=None, help="ref git de comparacao (ex.: origin/main)")
        sp.add_argument("--max-density", type=float, default=MAX_DENSITY)
        sp.add_argument("--strict", action="store_true", help="promove WARN (eco) a FAIL")
        sp.add_argument("--json", action="store_true")
        sp.add_argument("--output", type=Path, default=None, help="grava fragmento markdown")
    args = ap.parse_args(argv)

    violations, stats, code = run(args)
    if code == 1:
        return 1
    if args.cmd == "report":
        code = 0

    by_rule: dict[str, int] = defaultdict(int)
    for v in violations:
        by_rule[v.rule] += 1

    if args.json:
        print(json.dumps({
            "gate": "comment-budget",
            "decision": "D-580",
            "scope": "all" if args.all else f"diff:{args.base or 'worktree'}",
            "exit": code,
            "files_scanned": len(stats),
            "max_density": args.max_density,
            "by_rule": dict(by_rule),
            "violations": [v.__dict__ for v in violations],
        }, ensure_ascii=False, indent=2))
        return code

    scope = "arvore inteira" if args.all else f"diff ({args.base or 'worktree'})"
    body = f"# Gate comment-budget (D-580) — {scope}\n\n"
    if args.cmd == "report" or args.all:
        body += render_report(stats) + "\n"
    if args.cmd == "check":
        body += render_violations(violations)
        if violations:
            body += "\n" + ", ".join(f"{k}: {n}" for k, n in sorted(by_rule.items())) + "\n"
        body += f"\n**Veredito:** {'REPROVADO' if code else 'aprovado'} " \
                f"({len(stats)} ficheiros, exit {code}).\n"
    print(body)
    if args.output:
        args.output.write_text(body, encoding="utf-8")
    return code


if __name__ == "__main__":
    sys.exit(main())
