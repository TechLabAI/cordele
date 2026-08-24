#!/usr/bin/env python3
"""doc-scaffold.py - emit self-instructed artifact skeletons (D-372, Fase 3).

Converts "author the full structure freehand" into "fill the reasoning slots".
Each skeleton carries an `<!-- OUTPUT-SCHEMA -->` block (the required sections)
and `TODO[agent]` markers in every slot the agent must fill. After filling, the
artifact is gated by `render.py validate-output` (D-364): every required section
non-empty, no orphan TODO[agent].

  plan   --issue <ID> [--layer be|fe]   -> plan-<ISSUE>.md skeleton
  readme --service <svc>                -> operational README skeleton (sections 0-10)

The plan skeleton emits the exact unit headings `pole-position-split.py` parses
(`### Prioridade N` for be, `### fase-N` for fe) + an "Alvos de alteração" list,
so structural drift can no longer silently break the splitter.

Exit codes (R3): 0 success | 1 user error.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from cli_utils import force_utf8_stdio

TODO = "TODO[agent]"


def _plan_skeleton(issue: str, layer: str) -> str:
    unit = "Prioridade 1" if layer == "be" else "fase-1"
    unit2 = "Prioridade 2" if layer == "be" else "fase-2"
    path_hint = "src/.../Arquivo.java" if layer == "be" else "libs/<modulo>/.../arquivo.ts"
    return f"""\
<!-- OUTPUT-SCHEMA
- Status
- §0 Leitura executiva
- §1 Achados
- §2 Estratégia
- §3 Prioridades
- §4 Riscos
- §5 Critérios de aceite
-->

# Plano — {issue}

## Status
**Tipo:** {TODO} (Continuação | Incremental | Replanejamento | Review)
**Resumo:** {TODO}

## §0 Leitura executiva
{TODO}: 2-4 linhas — o que este plano entrega e por quê.

## §1 Achados
{TODO}: estado consolidado (do plan-state.json) + inconsistências relevantes.

## §2 Estratégia
{TODO}: tabela prioridade x objetivo x dependencia.

## §3 Prioridades

Uma unidade de trabalho por prioridade; cada uma lista seus "Alvos de alteração".

### {unit} — {TODO}
**Objetivo:** {TODO}
**Alvos de alteração:**
- `{path_hint}`  {TODO}: substituir pelos caminhos reais (um por linha)

**Critério verificável:** {TODO}

### {unit2} — {TODO}
**Objetivo:** {TODO}
**Alvos de alteração:**
- `{path_hint}`  {TODO}

**Critério verificável:** {TODO}

## §4 Riscos
{TODO}

## §5 Critérios de aceite
{TODO}: lista verificável (sem "ajustar/melhorar" — usar "criar/remover X").
"""


_README_SECTIONS = [
    ("0. Service Overview", "Papel / Responsabilidades / Fora de escopo / Schemas consumidos"),
    ("1. Arquitetura e Estrutura", "Stack / Organização de pacotes / Regras (RULE-01..09) / Multi-tenant"),
    ("2. Funcionalidades e Fluxos Principais", "Fluxos críticos / Eventos / Endpoints / Feign clients"),
    ("3. Estado Atual da Implementacao", "DONE / PARTIAL / MISSING"),
    ("4. Qualidade e Evidencias", "Testes / Cobertura / Observabilidade"),
    ("5. Gaps Atuais", "Lacunas conhecidas"),
    ("6. Issues Relacionadas ao Servico", "Lista de <MOD>-NNN com link"),
    ("7. Maturidade do Servico", "Score (0-100, do state.json) / Leitura executiva"),
    ("8. Historico de Evolucao (append-only)", "Uma linha por marco"),
    ("9. Estado Atual Resumido (para agentes)", "STRUCTURAL/FUNCTIONAL/INTEGRATION/OBSERVABILITY/RESILIENCE + MULTI-EMPRESA"),
    ("10. Proxima Atencao Recomendada", "Próximo foco"),
]


def _readme_skeleton(service: str) -> str:
    schema = "\n".join(f"- {title}" for title, _ in _README_SECTIONS)
    body = "\n\n".join(f"# {title}\n_{hint}_\n{TODO}" for title, hint in _README_SECTIONS)
    return f"""\
<!-- OUTPUT-SCHEMA
{schema}
-->

# {service} -- Operational README

{body}

END DOCUMENT
"""


# Registry of fixed-structure docs (vision 01-06, discovery 00-05). Each emits a
# self-instructed skeleton (OUTPUT-SCHEMA + TODO[agent] per section), validated by
# render.py validate-output. Section lists mirror the command outlines.
_DOC_KINDS: dict[str, dict] = {
    "vision-01": {"title": "01 — Architectural Vision", "sections": [
        "Intent", "Problem Statement", "Personas", "MVP Scope", "Out of Scope",
        "Architectural Principles", "Success Signals"]},
    "vision-02": {"title": "02 — Architecture Blueprint", "sections": [
        "System Boundary", "External Actors and Systems", "End-to-End Flows",
        "Internal Boundaries", "Cross-cutting Concerns"]},
    "vision-03": {"title": "03 — Initial Domain Framing", "sections": [
        "Ubiquitous Language", "Aggregates and Entities", "Domain Events",
        "State Transitions", "Invariants"]},
    "vision-04": {"title": "04 — Backend Architecture Direction", "sections": [
        "Stack", "Service Boundary", "Package Organization", "Hub Service Dependencies",
        "External Integrations", "Async vs Sync Decisions"]},
    "vision-05": {"title": "05 — Persistence Model", "sections": [
        "Schema Strategy", "Initial Entities", "Migration Strategy", "Data Lifecycle"]},
    "vision-06": {"title": "06 — Risks, Gaps, Assumptions", "sections": [
        "Riscos", "Gaps Conhecidos", "Suposicoes a Validar", "Dependencias Criticas"]},
    "discovery-00": {"title": "00 — Source Tree", "sections": [
        "Arvore do projeto", "Proposito por servico"]},
    "discovery-01": {"title": "01 — Module Inventory", "sections": ["Inventario de modulos"]},
    "discovery-02": {"title": "02 — External Dependencies", "sections": ["Dependencias externas"]},
    "discovery-03": {"title": "03 — Integration Points", "sections": ["Matriz de integracao cross-service"]},
    "discovery-04": {"title": "04 — Data Shapes", "sections": ["Formatos de dados observados"]},
    "discovery-05": {"title": "05 — Architecture Observed", "sections": [
        "Padrao arquitetural por slice", "Achados", "Riscos observados"]},
}


def _generic_skeleton(title: str, sections: list[str]) -> str:
    schema = "\n".join(f"- {s}" for s in sections)
    body = "\n\n".join(f"## {s}\n{TODO}: preencher." for s in sections)
    return f"<!-- OUTPUT-SCHEMA\n{schema}\n-->\n\n# {title}\n\n{body}\n"


def cmd_doc(args) -> int:
    if args.list_kinds:
        for k in _DOC_KINDS:
            print(k)
        return 0
    spec = _DOC_KINDS.get(args.kind)
    if spec is None:
        print(f"error: kind {args.kind!r} desconhecido; use --list-kinds", file=sys.stderr)
        return 1
    return _emit(_generic_skeleton(spec["title"], spec["sections"]), args.output, args.kind)


def _adr_skeleton(adr_id: str, title: str) -> str:
    return f"""\
<!-- OUTPUT-SCHEMA
- Status
- Contexto
- Decisão
- Consequências
-->

# ADR-{adr_id} — {title}

## Status
{TODO} (proposta | aceita | substituída por ADR-NNN)

## Contexto
{TODO}: forças em jogo, restrições, o problema que motiva a decisão.

## Decisão
{TODO}: a escolha feita, em voz ativa ("Vamos usar X porque...").

## Consequências
{TODO}: positivas, negativas e trade-offs aceitos.
"""


def _spec_skeleton(spec_id: str, title: str) -> str:
    return f"""\
<!-- OUTPUT-SCHEMA
- Objetivo
- Escopo
- Critérios (EARS)
- Cenários
-->

# SPEC-{spec_id} — {title}

## Objetivo
{TODO}: o que esta spec define, em uma frase.

## Escopo
{TODO}: dentro / fora de escopo.

## Critérios (EARS)
{TODO}: clausulas `THE SYSTEM SHALL ...` (uma por linha, verificáveis).

## Cenários
{TODO}: cenários Gherkin (`Scenario:`) que exercitam cada SHALL acima.
"""


def cmd_adr(args) -> int:
    return _emit(_adr_skeleton(args.id, args.title), args.output, f"ADR-{args.id}")


def cmd_spec(args) -> int:
    return _emit(_spec_skeleton(args.id, args.title), args.output, f"SPEC-{args.id}")


def _emit(text: str, output: str | None, label: str) -> int:
    if output:
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        Path(output).write_text(text, encoding="utf-8")
        print(f"OK: {label} skeleton -> {output} (preencha os {TODO} e rode "
              f"`render.py validate-output --artifact {output}`)")
    else:
        sys.stdout.write(text)
    return 0


def cmd_plan(args) -> int:
    return _emit(_plan_skeleton(args.issue, args.layer), args.output, f"plan-{args.issue}")


def cmd_readme(args) -> int:
    return _emit(_readme_skeleton(args.service), args.output, f"{args.service} README")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="doc-scaffold.py", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    pp = sub.add_parser("plan", help="emit a plan-<ISSUE>.md skeleton")
    pp.add_argument("--issue", required=True, metavar="ISSUE_ID")
    pp.add_argument("--layer", default="be", choices=["be", "fe"])
    pp.add_argument("--output", metavar="PATH")
    pp.set_defaults(func=cmd_plan)

    pr = sub.add_parser("readme", help="emit an operational README skeleton (sections 0-10)")
    pr.add_argument("--service", required=True)
    pr.add_argument("--output", metavar="PATH")
    pr.set_defaults(func=cmd_readme)

    pa = sub.add_parser("adr", help="emit an ADR skeleton")
    pa.add_argument("--id", required=True, metavar="NNN")
    pa.add_argument("--title", required=True)
    pa.add_argument("--output", metavar="PATH")
    pa.set_defaults(func=cmd_adr)

    psp = sub.add_parser("spec", help="emit a SPEC skeleton (EARS + scenarios)")
    psp.add_argument("--id", required=True, metavar="NN")
    psp.add_argument("--title", required=True)
    psp.add_argument("--output", metavar="PATH")
    psp.set_defaults(func=cmd_spec)

    pdoc = sub.add_parser("doc", help="emit a fixed-structure doc skeleton (vision-01..06, discovery-00..05)")
    pdoc.add_argument("--kind", help="doc kind (see --list-kinds)")
    pdoc.add_argument("--list-kinds", action="store_true")
    pdoc.add_argument("--output", metavar="PATH")
    pdoc.set_defaults(func=cmd_doc)

    return p


def main(argv: list[str] | None = None) -> int:
    force_utf8_stdio()
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
