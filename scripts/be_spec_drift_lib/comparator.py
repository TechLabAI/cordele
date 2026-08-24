"""comparator.py — drift comparator (D-160, D-162).

Reads the code-mapping aspect and produces a list of typed DriftFindings by
applying each rule against (EarsClause list, JavaFacts, arch.json bundle).

Read-only: never writes files. The driver (scripts/be-spec-drift.py) renders
the findings into a markdown report via Jinja.

Drift classes:
- MISSING_IN_CODE: spec/arch demands; AST silent
- MISSING_IN_SPEC: AST has; spec/arch silent
- MISMATCH: both have but values differ
- UNMAPPED: EARS clause doesn't match any rule (coverage gap, not drift)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .ears_parser import EarsClause
from .java_ast import (
    AnnotationFact,
    JavaFacts,
    MethodCallFact,
)

DRIFT_CLASSES = ("MISSING_IN_CODE", "MISSING_IN_SPEC", "MISMATCH", "UNMAPPED")


@dataclass
class DriftFinding:
    """One row in the drift report."""

    drift_class: str  # MISSING_IN_CODE / MISSING_IN_SPEC / MISMATCH / UNMAPPED
    rule_id: str  # "E1" / "A2" / "UNMAPPED"
    drift_type: str  # rule's drift_type (e.g. "endpoint_mismatch") or "unmapped"
    severity: str  # error / warning / info
    spec_evidence: str | None = None
    code_evidence: str | None = None
    location_spec: str | None = None  # "file:line"
    location_code: str | None = None  # "file:line"
    detail: str | None = None
    resolution_hint: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "drift_class": self.drift_class,
            "rule_id": self.rule_id,
            "drift_type": self.drift_type,
            "severity": self.severity,
            "spec_evidence": self.spec_evidence,
            "code_evidence": self.code_evidence,
            "location_spec": self.location_spec,
            "location_code": self.location_code,
            "detail": self.detail,
            "resolution_hint": self.resolution_hint,
        }


@dataclass
class ComparatorReport:
    findings: list[DriftFinding] = field(default_factory=list)
    matched_clauses: set[int] = field(default_factory=set)  # ids of matched EarsClause

    def by_class(self, drift_class: str) -> list[DriftFinding]:
        return [f for f in self.findings if f.drift_class == drift_class]

    def summary(self) -> dict[str, int]:
        out = {c: 0 for c in DRIFT_CLASSES}
        for f in self.findings:
            out[f.drift_class] = out.get(f.drift_class, 0) + 1
        return out


# ── Helpers ─────────────────────────────────────────────────────────────────


def _resolution_hint(drift_class: str, code_mapping: dict[str, Any]) -> str:
    hints = (code_mapping.get("resolution_hint") or {}).get("by_drift_class") or {}
    return hints.get(drift_class, "")


def _re(pattern: str) -> re.Pattern:
    return re.compile(pattern, re.IGNORECASE)


def _path_loc(file: str | None, line: int | None) -> str | None:
    if file is None:
        return None
    return f"{file}:{line}" if line is not None else file


def _value_contains_jinja(value: Any) -> bool:
    if isinstance(value, str):
        return "{{" in value and "}}" in value
    return False


def _aspect_field(aspect_data: dict[str, Any], json_path: str) -> Any:
    """Resolve a dotted path like 'enforcement.default'. '$presence' is special."""
    if json_path == "$presence":
        return aspect_data  # non-None = present
    cur: Any = aspect_data
    for segment in json_path.split("."):
        if not isinstance(cur, dict) or segment not in cur:
            return None
        cur = cur[segment]
    return cur


# ── EARS pattern matching ───────────────────────────────────────────────────


def _match_endpoint_rule(
    rule: dict[str, Any],
    clauses: list[EarsClause],
    facts: JavaFacts,
    matched_clause_ids: set[int],
) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    rule_id = rule["id"]
    drift_type = rule["drift_type"]
    severity = rule["severity"]
    spec_rx = _re(rule["spec_pattern"])
    fallback_rx = _re(rule["fallback_spec_pattern"]) if rule.get("fallback_spec_pattern") else None

    spec_endpoints: list[tuple[str, str, EarsClause]] = []
    for clause in clauses:
        m = spec_rx.search(clause.normalized_text)
        if not m and fallback_rx is not None:
            m = fallback_rx.search(clause.normalized_text)
        if not m:
            continue
        matched_clause_ids.add(id(clause))
        verbs_in_text = re.findall(
            r"\b(POST|GET|PUT|PATCH|DELETE)\b", clause.normalized_text
        )
        method = verbs_in_text[0] if verbs_in_text else (m.groupdict().get("method") or "POST")
        path_g = m.groupdict().get("path") or ""
        spec_endpoints.append((method, path_g, clause))

    code_endpoints = {(ep.http_method, ep.path): ep for ep in facts.endpoints}

    for method, path, clause in spec_endpoints:
        if (method, path) in code_endpoints:
            continue
        # Heuristic: path may have placeholders; allow REQUEST match too
        partial = [ep for k, ep in code_endpoints.items() if k[1] == path]
        if partial:
            ep = partial[0]
            findings.append(
                DriftFinding(
                    drift_class="MISMATCH",
                    rule_id=rule_id,
                    drift_type=drift_type,
                    severity=severity,
                    spec_evidence=f"{method} {path}",
                    code_evidence=f"{ep.http_method} {ep.path} -> {ep.controller_class}.{ep.method_name}",
                    location_spec=_path_loc(clause.file, clause.line),
                    location_code=_path_loc(ep.file, ep.line),
                    detail=f"Spec declares HTTP method {method}; code implements {ep.http_method} on same path.",
                )
            )
        else:
            findings.append(
                DriftFinding(
                    drift_class="MISSING_IN_CODE",
                    rule_id=rule_id,
                    drift_type=drift_type,
                    severity=severity,
                    spec_evidence=f"{method} {path}",
                    code_evidence=None,
                    location_spec=_path_loc(clause.file, clause.line),
                    detail=f"Spec declares endpoint {method} {path}; no matching @{method.title()}Mapping in controllers.",
                )
            )

    # Reverse: endpoints in code with no spec mention
    spec_paths = {p for _m, p, _c in spec_endpoints}
    for (method, path), ep in code_endpoints.items():
        if path in spec_paths:
            continue
        findings.append(
            DriftFinding(
                drift_class="MISSING_IN_SPEC",
                rule_id=rule_id,
                drift_type=drift_type,
                severity="warning",
                spec_evidence=None,
                code_evidence=f"{method} {path} -> {ep.controller_class}.{ep.method_name}",
                location_code=_path_loc(ep.file, ep.line),
                detail=f"Code exposes endpoint {method} {path}; no spec clause declares it.",
            )
        )
    return findings


def _match_rbac_role_rule(
    rule: dict[str, Any],
    clauses: list[EarsClause],
    facts: JavaFacts,
    matched_clause_ids: set[int],
) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    rule_id = rule["id"]
    drift_type = rule["drift_type"]
    severity = rule["severity"]
    spec_rx = _re(rule["spec_pattern"])
    value_rx = re.compile(rule["ast_match"]["value_regex"])
    spec_roles: list[tuple[str, EarsClause]] = []
    for clause in clauses:
        for m in spec_rx.finditer(clause.normalized_text):
            matched_clause_ids.add(id(clause))
            role = m.group("role")
            spec_roles.append((role, clause))
    code_roles: list[tuple[str, AnnotationFact]] = []
    for ann in facts.filter_annotations("PreAuthorize"):
        if not ann.value:
            continue
        for m in value_rx.finditer(ann.value):
            code_roles.append((m.group("role"), ann))

    spec_role_set = {r for r, _c in spec_roles}
    code_role_set = {r for r, _a in code_roles}

    for role, clause in spec_roles:
        if role not in code_role_set:
            findings.append(
                DriftFinding(
                    drift_class="MISSING_IN_CODE",
                    rule_id=rule_id,
                    drift_type=drift_type,
                    severity=severity,
                    spec_evidence=f"role {role}",
                    location_spec=_path_loc(clause.file, clause.line),
                    detail=f"Spec requires role {role}; no @PreAuthorize references it.",
                )
            )
    for role, ann in code_roles:
        if role not in spec_role_set:
            findings.append(
                DriftFinding(
                    drift_class="MISSING_IN_SPEC",
                    rule_id=rule_id,
                    drift_type=drift_type,
                    severity="warning",
                    code_evidence=f"@PreAuthorize hasRole('{role}') on {ann.target_name}",
                    location_code=_path_loc(ann.file, ann.line),
                    detail=f"Code enforces role {role}; spec doesn't declare it.",
                )
            )
    return findings


def _match_validation_rule(
    rule: dict[str, Any],
    clauses: list[EarsClause],
    facts: JavaFacts,
    matched_clause_ids: set[int],
) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    rule_id = rule["id"]
    drift_type = rule["drift_type"]
    severity = rule["severity"]
    spec_rx = _re(rule["spec_pattern"])
    fallback_rx = _re(rule["fallback_spec_pattern"]) if rule.get("fallback_spec_pattern") else None
    ann_any = rule["ast_match"].get("annotation_any") or [rule["ast_match"].get("annotation")]
    spec_fields: list[tuple[str, str | None, EarsClause]] = []
    for clause in clauses:
        m = spec_rx.search(clause.normalized_text)
        if not m and fallback_rx is not None:
            m = fallback_rx.search(clause.normalized_text)
        if not m:
            continue
        matched_clause_ids.add(id(clause))
        gd = m.groupdict()
        spec_fields.append((gd.get("field"), gd.get("max"), clause))

    code_fields = {
        fv.field_name: fv
        for fv in facts.field_validations
        if fv.annotation in ann_any
    }
    spec_field_set = {f for f, _m, _c in spec_fields}

    for field_name, max_val, clause in spec_fields:
        if field_name not in code_fields:
            findings.append(
                DriftFinding(
                    drift_class="MISSING_IN_CODE",
                    rule_id=rule_id,
                    drift_type=drift_type,
                    severity=severity,
                    spec_evidence=f"validation on field '{field_name}'",
                    location_spec=_path_loc(clause.file, clause.line),
                    detail=f"Spec requires validation on field '{field_name}'; no matching annotation in DTOs.",
                )
            )
        else:
            fv = code_fields[field_name]
            if max_val is not None:
                code_max = fv.attributes.get("max")
                if code_max is not None and code_max != max_val:
                    findings.append(
                        DriftFinding(
                            drift_class="MISMATCH",
                            rule_id=rule_id,
                            drift_type=drift_type,
                            severity=severity,
                            spec_evidence=f"max {max_val} for '{field_name}'",
                            code_evidence=f"max {code_max} on @Size({fv.enclosing_class}.{fv.field_name})",
                            location_spec=_path_loc(clause.file, clause.line),
                            location_code=_path_loc(fv.file, fv.line),
                            detail=f"Spec says max={max_val}; code uses max={code_max}.",
                        )
                    )
    for field_name, fv in code_fields.items():
        if field_name not in spec_field_set:
            findings.append(
                DriftFinding(
                    drift_class="MISSING_IN_SPEC",
                    rule_id=rule_id,
                    drift_type=drift_type,
                    severity="warning",
                    code_evidence=f"@{fv.annotation} on {fv.enclosing_class}.{fv.field_name}",
                    location_code=_path_loc(fv.file, fv.line),
                    detail=f"Code validates '{field_name}'; spec is silent.",
                )
            )
    return findings


def _match_event_rule(
    rule: dict[str, Any],
    clauses: list[EarsClause],
    facts: JavaFacts,
    matched_clause_ids: set[int],
) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    rule_id = rule["id"]
    drift_type = rule["drift_type"]
    severity = rule["severity"]
    spec_rx = _re(rule["spec_pattern"])

    spec_topics: list[tuple[str, str, EarsClause]] = []  # event, topic, clause
    for clause in clauses:
        m = spec_rx.search(clause.normalized_text)
        if not m:
            continue
        matched_clause_ids.add(id(clause))
        spec_topics.append((m.group("event"), m.group("topic"), clause))

    publish_calls = [
        m for m in facts.method_calls
        if m.qualifier and re.search(r"jmsTemplate|kafkaTemplate|rabbitTemplate", m.qualifier)
    ]
    has_any_publish = bool(publish_calls)

    for event, topic, clause in spec_topics:
        if not has_any_publish:
            findings.append(
                DriftFinding(
                    drift_class="MISSING_IN_CODE",
                    rule_id=rule_id,
                    drift_type=drift_type,
                    severity=severity,
                    spec_evidence=f"publish {event} to {topic}",
                    location_spec=_path_loc(clause.file, clause.line),
                    detail=f"Spec demands publish of {event} on {topic}; no jmsTemplate / kafkaTemplate / rabbitTemplate call found.",
                )
            )
        else:
            # Look for a constant string equal to the topic in any of the
            # facts' raw annotations or fall back to searching the file text.
            # The Java AST module already captured method calls; topic literal
            # values aren't currently captured as facts. Conservative report:
            # warn only on missing publish, accept presence as evidence.
            pass
    return findings


def _match_context_resolution_rule(
    rule: dict[str, Any],
    clauses: list[EarsClause],
    facts: JavaFacts,
    matched_clause_ids: set[int],
) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    rule_id = rule["id"]
    drift_type = rule["drift_type"]
    severity = rule["severity"]
    spec_rx = _re(rule["spec_pattern"])
    qualifier_rx = re.compile(rule["ast_match"]["method_call"]["qualifier_regex"])
    name_rx = re.compile(rule["ast_match"]["method_call"]["name_regex"])

    spec_holders: list[tuple[str, EarsClause]] = []
    for clause in clauses:
        m = spec_rx.search(clause.normalized_text)
        if not m:
            continue
        matched_clause_ids.add(id(clause))
        spec_holders.append((m.group("holder"), clause))

    code_calls: list[MethodCallFact] = [
        c for c in facts.method_calls
        if c.qualifier and qualifier_rx.search(c.qualifier) and name_rx.search(c.method)
    ]
    code_qualifiers = {c.qualifier for c in code_calls}

    for holder, clause in spec_holders:
        if not any(q == holder or (q and holder in q) for q in code_qualifiers):
            findings.append(
                DriftFinding(
                    drift_class="MISSING_IN_CODE",
                    rule_id=rule_id,
                    drift_type=drift_type,
                    severity=severity,
                    spec_evidence=f"resolve from {holder}",
                    location_spec=_path_loc(clause.file, clause.line),
                    detail=f"Spec demands context resolution via {holder}; no matching call found.",
                )
            )
    return findings


def _match_audit_rule(
    rule: dict[str, Any],
    clauses: list[EarsClause],
    facts: JavaFacts,
    matched_clause_ids: set[int],
) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    rule_id = rule["id"]
    drift_type = rule["drift_type"]
    severity = rule["severity"]
    spec_rx = _re(rule["spec_pattern"])
    audit_anns = facts.filter_annotations("AuditAction", target="method")
    has_audit = bool(audit_anns)

    matched_in_spec = False
    first_match: EarsClause | None = None
    for clause in clauses:
        if spec_rx.search(clause.normalized_text):
            matched_clause_ids.add(id(clause))
            matched_in_spec = True
            if first_match is None:
                first_match = clause
    if matched_in_spec and not has_audit:
        findings.append(
            DriftFinding(
                drift_class="MISSING_IN_CODE",
                rule_id=rule_id,
                drift_type=drift_type,
                severity=severity,
                spec_evidence="audit log emission required",
                location_spec=_path_loc(first_match.file, first_match.line) if first_match else None,
                detail="Spec demands audit log; no @AuditAction annotations on controllers.",
            )
        )
    return findings


# ── arch.json field matching ────────────────────────────────────────────────


def _match_arch_rbac_enforcement(
    rule: dict[str, Any],
    aspect_data: dict[str, Any],
    facts: JavaFacts,
) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    rule_id = rule["id"]
    drift_type = rule["drift_type"]
    severity = rule["severity"]
    expected = rule.get("expected_value")
    value = _aspect_field(aspect_data, rule["json_path"])
    if value is None or _value_contains_jinja(value):
        return []
    if expected is not None and value != expected:
        findings.append(
            DriftFinding(
                drift_class="MISMATCH",
                rule_id=rule_id,
                drift_type=drift_type,
                severity=severity,
                spec_evidence=f"{rule['aspect_file']}#{rule['json_path']} = {value!r}",
                code_evidence=None,
                detail=f"Aspect declares enforcement={value!r} but rule expected {expected!r}.",
            )
        )
    # When expected matches, ensure every Port-implementing service in
    # application/service/ has @PreAuthorize.
    pre = {a.target_name for a in facts.filter_annotations("PreAuthorize", target="method")}
    # Heuristic: any method in application/service/ named after the port action
    # ought to have PreAuthorize. Skip non-public methods (not captured).
    service_methods = [
        a for a in facts.annotations
        if a.target == "method"
        and a.name in {"Service", "Component"}
    ]
    # If a service class has no @PreAuthorize on any of its methods, flag.
    classes_with_service = {a.target_name.split(".")[0] for a in service_methods}
    classes_with_preauth = {tn.split(".")[0] for tn in pre}
    for cls in classes_with_service:
        if cls not in classes_with_preauth:
            findings.append(
                DriftFinding(
                    drift_class="MISSING_IN_CODE",
                    rule_id=rule_id,
                    drift_type=drift_type,
                    severity="warning",
                    spec_evidence=f"{rule['aspect_file']}#{rule['json_path']} = {value!r}",
                    code_evidence=f"class {cls} (@Service / @Component) has no @PreAuthorize",
                    detail=f"Aspect demands enforcement={value!r}; class {cls} appears to lack it.",
                )
            )
    return findings


def _match_arch_audit_required(
    rule: dict[str, Any],
    aspect_data: dict[str, Any],
    facts: JavaFacts,
) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    rule_id = rule["id"]
    drift_type = rule["drift_type"]
    severity = rule["severity"]
    required = _aspect_field(aspect_data, rule["json_path"]) or []
    if not isinstance(required, list):
        return []
    verb_map = rule["ast_match"]["http_verbs"]
    has_audit_on_method = {
        a.target_name for a in facts.filter_annotations("AuditAction", target="method")
    }
    for verb in required:
        ann_names = verb_map.get(verb, [])
        endpoints_for_verb = [
            ep for ep in facts.endpoints
            if any(a.name in ann_names for a in facts.annotations
                   if a.target == "method"
                   and a.target_name == f"{ep.controller_class}.{ep.method_name}")
        ]
        for ep in endpoints_for_verb:
            tn = f"{ep.controller_class}.{ep.method_name}"
            if tn not in has_audit_on_method:
                findings.append(
                    DriftFinding(
                        drift_class="MISSING_IN_CODE",
                        rule_id=rule_id,
                        drift_type=drift_type,
                        severity=severity,
                        spec_evidence=f"audit_required contains {verb!r}",
                        code_evidence=f"{verb} endpoint {ep.path} -> {tn} (no @AuditAction)",
                        location_code=_path_loc(ep.file, ep.line),
                        detail=f"Aspect requires audit on {verb}; endpoint {tn} is missing @AuditAction.",
                    )
                )
    return findings


def _match_arch_tenancy_filter(
    rule: dict[str, Any],
    aspect_data: dict[str, Any],
    facts: JavaFacts,
) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    rule_id = rule["id"]
    drift_type = rule["drift_type"]
    severity = rule["severity"]
    rx = re.compile(rule["ast_match"]["class_name_regex"])
    candidates = [c for c in facts.filter_orders if rx.search(c)]
    if not candidates:
        findings.append(
            DriftFinding(
                drift_class="MISSING_IN_CODE",
                rule_id=rule_id,
                drift_type=drift_type,
                severity=severity,
                spec_evidence=f"{rule['aspect_file']} present (multi-tenancy aspect)",
                code_evidence=None,
                detail="No class matching TenantContextFilter regex found with @Order annotation.",
            )
        )
    return findings


def _match_arch_exception_handler(
    rule: dict[str, Any],
    aspect_data: dict[str, Any],
    facts: JavaFacts,
) -> list[DriftFinding]:
    findings: list[DriftFinding] = []
    rule_id = rule["id"]
    drift_type = rule["drift_type"]
    severity = rule["severity"]
    required = rule["ast_match"].get("exception_handlers_required") or []
    handled = {h.handled_exception for h in facts.exception_handlers}
    missing = [r for r in required if r not in handled]
    if missing:
        findings.append(
            DriftFinding(
                drift_class="MISSING_IN_CODE",
                rule_id=rule_id,
                drift_type=drift_type,
                severity=severity,
                spec_evidence=f"{rule['aspect_file']} present (error-model aspect)",
                code_evidence=f"@RestControllerAdvice handles {sorted(handled) or '<none>'}",
                detail=f"Aspect demands handlers for: {required}. Missing: {missing}.",
            )
        )
    return findings


# ── Dispatcher ──────────────────────────────────────────────────────────────


_EARS_RULE_HANDLERS: dict[str, Any] = {
    "E1": _match_endpoint_rule,
    "E2": _match_rbac_role_rule,
    "E3": _match_validation_rule,
    "E3b": _match_validation_rule,
    "E4": _match_event_rule,
    "E5": _match_context_resolution_rule,
    "E6": _match_audit_rule,
}

_ARCH_RULE_HANDLERS: dict[str, Any] = {
    "A1": _match_arch_rbac_enforcement,
    "A2": _match_arch_audit_required,
    "A3": _match_arch_tenancy_filter,
    "A4": _match_arch_exception_handler,
}


def compare(
    *,
    clauses: list[EarsClause],
    facts: JavaFacts,
    code_mapping: dict[str, Any],
    arch_data: dict[str, dict[str, Any]],  # {"rbac.arch.json": {...}, ...}
    show_unmapped: bool = False,
) -> ComparatorReport:
    """Apply every rule from code_mapping; return ComparatorReport.

    `arch_data` maps aspect file names (e.g. "rbac.arch.json") to the loaded
    JSON content. Aspects referenced by a rule but absent here are skipped.
    """
    report = ComparatorReport()
    matched_clause_ids: set[int] = set()

    for rule in code_mapping.get("ears_patterns", []):
        handler = _EARS_RULE_HANDLERS.get(rule["id"])
        if handler is None:
            continue
        findings = handler(rule, clauses, facts, matched_clause_ids)
        for f in findings:
            f.resolution_hint = _resolution_hint(f.drift_class, code_mapping)
        report.findings.extend(findings)

    for rule in code_mapping.get("arch_aspects", []):
        aspect_data = arch_data.get(rule["aspect_file"])
        if aspect_data is None:
            continue
        handler = _ARCH_RULE_HANDLERS.get(rule["id"])
        if handler is None:
            continue
        findings = handler(rule, aspect_data, facts)
        for f in findings:
            f.resolution_hint = _resolution_hint(f.drift_class, code_mapping)
        report.findings.extend(findings)

    # UNMAPPED clauses (only if requested)
    report.matched_clauses = matched_clause_ids
    if show_unmapped:
        for clause in clauses:
            if id(clause) in matched_clause_ids:
                continue
            if clause.pattern_type == "loose":
                continue  # loose = noise, not coverage gap
            report.findings.append(
                DriftFinding(
                    drift_class="UNMAPPED",
                    rule_id="UNMAPPED",
                    drift_type="unmapped",
                    severity="info",
                    spec_evidence=clause.normalized_text[:200],
                    location_spec=_path_loc(clause.file, clause.line),
                    detail="Clause didn't match any rule. Extend the mapping or mark as prose.",
                    resolution_hint=_resolution_hint("UNMAPPED", code_mapping),
                )
            )

    return report
