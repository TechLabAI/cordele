"""java_ast.py — extract Java AST facts via javalang.

Walks the source tree under a service root and returns a JavaFacts bundle
the comparator consumes. Read-only: never edits Java files.

Design notes:

- Uses javalang (pure Python, no JVM dependency).
- Skips files that fail to parse — records them in JavaFacts.unparsed.
- Resolves controller paths by joining class-level @RequestMapping("/v1/x")
  with method-level @PostMapping("/sub") → "/v1/x/sub".
- For @PreAuthorize values, captures the literal string verbatim (the
  comparator extracts roles via the rule's value_regex).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

try:
    import javalang  # type: ignore
    from javalang.tree import (  # type: ignore
        Annotation,
        ClassDeclaration,
        CompilationUnit,
        FieldDeclaration,
        MethodDeclaration,
        MethodInvocation,
    )
except ImportError as e:  # pragma: no cover
    raise ImportError(
        "javalang is required for spec drift detection. "
        "Install with: pip install javalang>=0.13,<0.14"
    ) from e


# ── Data shapes ─────────────────────────────────────────────────────────────


@dataclass
class AnnotationFact:
    """One @Annotation occurrence on a class / method / field / parameter."""

    name: str  # short name without @ (e.g. "PostMapping")
    target: str  # "class" | "method" | "field" | "parameter"
    target_name: str  # owning class.method or class.field name
    file: str  # source file path (relative if possible)
    line: int | None  # source line if available
    attributes: dict[str, str] = field(default_factory=dict)
    # "value" attribute often holds the primary literal — captured separately
    value: str | None = None


@dataclass
class EndpointFact:
    """A REST endpoint discovered in a controller."""

    http_method: str  # POST | GET | PUT | PATCH | DELETE | REQUEST
    path: str  # full path joining class + method mappings
    controller_class: str
    method_name: str
    file: str
    line: int | None


@dataclass
class MethodCallFact:
    """A noteworthy method invocation (e.g. TenantContextHolder.require())."""

    qualifier: str | None  # "TenantContextHolder" in "TenantContextHolder.require()"
    method: str  # "require"
    file: str
    line: int | None
    enclosing_class: str
    enclosing_method: str


@dataclass
class ExceptionHandlerFact:
    """An @ExceptionHandler method in a @RestControllerAdvice class."""

    advice_class: str
    handled_exception: str  # e.g. "CodedException"
    file: str
    line: int | None


@dataclass
class FieldValidationFact:
    """A bean-validation annotation on a record component or DTO field."""

    annotation: str  # NotBlank / NotNull / Size / NotEmpty
    field_name: str
    enclosing_class: str
    file: str
    line: int | None
    attributes: dict[str, str] = field(default_factory=dict)


@dataclass
class JavaFacts:
    """Aggregate of facts extracted from a service tree."""

    annotations: list[AnnotationFact] = field(default_factory=list)
    endpoints: list[EndpointFact] = field(default_factory=list)
    method_calls: list[MethodCallFact] = field(default_factory=list)
    exception_handlers: list[ExceptionHandlerFact] = field(default_factory=list)
    field_validations: list[FieldValidationFact] = field(default_factory=list)
    filter_orders: dict[str, int] = field(default_factory=dict)
    parsed_files: list[str] = field(default_factory=list)
    unparsed: list[tuple[str, str]] = field(default_factory=list)  # (path, error)

    def filter_annotations(
        self, name: str, *, target: str | None = None
    ) -> list[AnnotationFact]:
        out = [a for a in self.annotations if a.name == name]
        if target:
            out = [a for a in out if a.target == target]
        return out


# ── javalang helpers ────────────────────────────────────────────────────────


_HTTP_VERBS = {
    "PostMapping": "POST",
    "GetMapping": "GET",
    "PutMapping": "PUT",
    "PatchMapping": "PATCH",
    "DeleteMapping": "DELETE",
    "RequestMapping": "REQUEST",
}

_VALIDATION_ANNOTATIONS = {"NotBlank", "NotNull", "Size", "NotEmpty"}


def _annotation_name(ann: Annotation) -> str:
    """Return the simple (last segment) name of an annotation."""
    raw = ann.name
    if isinstance(raw, str):
        return raw.split(".")[-1]
    return str(raw).split(".")[-1]


def _stringify_value(node) -> str | None:
    """Best-effort extraction of a string literal or expression value."""
    if node is None:
        return None
    # javalang Literal
    if hasattr(node, "value"):
        raw = node.value
        if isinstance(raw, str):
            # strip surrounding quotes
            if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in ("'", '"'):
                return raw[1:-1]
            return raw
    # MemberReference fallback
    if hasattr(node, "member"):
        return str(node.member)
    return None


def _annotation_attributes(ann: Annotation) -> tuple[dict[str, str], str | None]:
    """Return (attrs_dict, primary_value).

    The primary_value comes from @Foo("x") shorthand (no element pair) or from
    an explicit "value" element.
    """
    attrs: dict[str, str] = {}
    primary: str | None = None
    if ann.element is None:
        return attrs, primary
    # Shorthand single-value: @Foo("x") — element is a list with one Literal
    if isinstance(ann.element, list):
        # could be element-pairs OR a single literal
        for el in ann.element:
            if hasattr(el, "name") and hasattr(el, "value"):
                v = _stringify_value(el.value)
                if v is not None:
                    attrs[el.name] = v
                    if el.name == "value":
                        primary = v
            else:
                v = _stringify_value(el)
                if v is not None and primary is None:
                    primary = v
    else:
        v = _stringify_value(ann.element)
        if v is not None:
            primary = v
    return attrs, primary


def _line_of(node) -> int | None:
    pos = getattr(node, "position", None)
    if pos is not None and hasattr(pos, "line"):
        return pos.line
    return None


def _join_path(prefix: str | None, suffix: str | None) -> str:
    a = (prefix or "").strip()
    b = (suffix or "").strip()
    if not a and not b:
        return ""
    if not a:
        return b if b.startswith("/") else "/" + b
    if not b:
        return a
    if a.endswith("/"):
        a = a[:-1]
    if not b.startswith("/"):
        b = "/" + b
    return a + b


# ── Per-file extraction ─────────────────────────────────────────────────────


def _extract_class_facts(
    cu: CompilationUnit, file_str: str, facts: JavaFacts
) -> None:
    for type_decl in cu.types or []:
        if not isinstance(type_decl, ClassDeclaration):
            continue
        class_name = type_decl.name
        class_request_mapping = ""
        class_is_advice = False

        # Class-level annotations
        for ann in type_decl.annotations or []:
            name = _annotation_name(ann)
            attrs, primary = _annotation_attributes(ann)
            facts.annotations.append(
                AnnotationFact(
                    name=name,
                    target="class",
                    target_name=class_name,
                    file=file_str,
                    line=_line_of(ann),
                    attributes=attrs,
                    value=primary,
                )
            )
            if name == "RequestMapping":
                class_request_mapping = primary or ""
            if name == "RestControllerAdvice":
                class_is_advice = True
            if name == "Order":
                try:
                    facts.filter_orders[class_name] = int(primary) if primary else 0
                except (ValueError, TypeError):
                    pass

        # Field annotations (DTO records typically use components, not fields,
        # but we still catch field-style DTOs)
        for field_decl in type_decl.fields or []:
            if not isinstance(field_decl, FieldDeclaration):
                continue
            for declarator in field_decl.declarators or []:
                f_name = declarator.name
                for ann in field_decl.annotations or []:
                    a_name = _annotation_name(ann)
                    attrs, primary = _annotation_attributes(ann)
                    facts.annotations.append(
                        AnnotationFact(
                            name=a_name,
                            target="field",
                            target_name=f"{class_name}.{f_name}",
                            file=file_str,
                            line=_line_of(ann),
                            attributes=attrs,
                            value=primary,
                        )
                    )
                    if a_name in _VALIDATION_ANNOTATIONS:
                        facts.field_validations.append(
                            FieldValidationFact(
                                annotation=a_name,
                                field_name=f_name,
                                enclosing_class=class_name,
                                file=file_str,
                                line=_line_of(ann),
                                attributes=attrs,
                            )
                        )

        # Methods
        for method in type_decl.methods or []:
            if not isinstance(method, MethodDeclaration):
                continue
            method_name = method.name
            method_mapping_verb = None
            method_mapping_path = None

            for ann in method.annotations or []:
                a_name = _annotation_name(ann)
                attrs, primary = _annotation_attributes(ann)
                facts.annotations.append(
                    AnnotationFact(
                        name=a_name,
                        target="method",
                        target_name=f"{class_name}.{method_name}",
                        file=file_str,
                        line=_line_of(ann),
                        attributes=attrs,
                        value=primary,
                    )
                )
                if a_name in _HTTP_VERBS:
                    method_mapping_verb = _HTTP_VERBS[a_name]
                    method_mapping_path = primary
                if a_name == "ExceptionHandler" and class_is_advice:
                    # Primary value is a class literal; javalang exposes it
                    # as MemberReference or ClassReference depending on shape.
                    handled = primary or ""
                    if not handled and ann.element is not None:
                        # Try harder — walk element for a class identifier
                        el = ann.element
                        if isinstance(el, list) and el:
                            el = el[0]
                        if hasattr(el, "type") and hasattr(el.type, "name"):
                            handled = el.type.name
                        elif hasattr(el, "member"):
                            handled = el.member
                    facts.exception_handlers.append(
                        ExceptionHandlerFact(
                            advice_class=class_name,
                            handled_exception=handled,
                            file=file_str,
                            line=_line_of(ann),
                        )
                    )

            # Parameter annotations (bean-validation on record params is captured
            # via record components below; here we capture params explicitly typed)
            for param in method.parameters or []:
                for ann in param.annotations or []:
                    a_name = _annotation_name(ann)
                    attrs, primary = _annotation_attributes(ann)
                    facts.annotations.append(
                        AnnotationFact(
                            name=a_name,
                            target="parameter",
                            target_name=f"{class_name}.{method_name}({param.name})",
                            file=file_str,
                            line=_line_of(ann),
                            attributes=attrs,
                            value=primary,
                        )
                    )
                    if a_name in _VALIDATION_ANNOTATIONS:
                        facts.field_validations.append(
                            FieldValidationFact(
                                annotation=a_name,
                                field_name=param.name,
                                enclosing_class=class_name,
                                file=file_str,
                                line=_line_of(ann),
                                attributes=attrs,
                            )
                        )

            # Endpoint emission
            if method_mapping_verb:
                full_path = _join_path(class_request_mapping, method_mapping_path)
                facts.endpoints.append(
                    EndpointFact(
                        http_method=method_mapping_verb,
                        path=full_path,
                        controller_class=class_name,
                        method_name=method_name,
                        file=file_str,
                        line=_line_of(method),
                    )
                )

            # Method-body invocations of interest (TenantContextHolder, jmsTemplate)
            if method.body:
                _collect_method_invocations(
                    method.body, file_str, class_name, method_name, facts
                )


def _collect_method_invocations(
    body, file_str: str, class_name: str, method_name: str, facts: JavaFacts
) -> None:
    # javalang exposes a filter() helper, but stays clearer with manual walk
    for _path, node in _walk(body):
        if isinstance(node, MethodInvocation):
            facts.method_calls.append(
                MethodCallFact(
                    qualifier=node.qualifier,
                    method=node.member,
                    file=file_str,
                    line=_line_of(node),
                    enclosing_class=class_name,
                    enclosing_method=method_name,
                )
            )


def _walk(node):
    """Pre-order walk over a javalang subtree, yielding (path_unused, node)."""
    stack = [(None, node)]
    while stack:
        path, current = stack.pop()
        if current is None:
            continue
        yield path, current
        children = []
        if isinstance(current, list):
            children = list(current)
        elif hasattr(current, "children"):
            for child in current.children:
                if isinstance(child, list):
                    children.extend(child)
                elif hasattr(child, "children"):
                    children.append(child)
        for c in reversed(children):
            stack.append((None, c))


# ── Regex fallbacks for files javalang can't parse ──────────────────────────


_CLASS_DECL_RX = re.compile(
    # Optional annotations block, then `public/abstract/...` class/interface/enum
    r"(?P<anns>(?:@\w+(?:\([^)]*\))?\s+)*)"
    r"(?:public\s+|protected\s+|private\s+|abstract\s+|final\s+|static\s+)*"
    r"(?:class|interface|enum)\s+(?P<name>\w+)",
    re.MULTILINE,
)

_ANN_INLINE_RX = re.compile(
    r"@(?P<name>\w+)(?:\((?P<args>[^)]*)\))?",
)


def _extract_class_annotations_via_regex(
    text: str, file_str: str, facts: JavaFacts
) -> None:
    """Capture class-level annotations on files javalang couldn't parse.

    Used as a fallback when javalang fails (records, modern pattern matching,
    sealed types, etc.). Conservative: only picks up annotations *immediately
    preceding* a class/interface/enum declaration.
    """
    for cls_m in _CLASS_DECL_RX.finditer(text):
        class_name = cls_m.group("name")
        anns_block = cls_m.group("anns") or ""
        for ann_m in _ANN_INLINE_RX.finditer(anns_block):
            a_name = ann_m.group("name")
            raw_args = (ann_m.group("args") or "").strip()
            attrs: dict[str, str] = {}
            primary: str | None = None
            if raw_args:
                # Parse simple forms: bare value, key=value, "literal"
                if "=" in raw_args:
                    for pair in raw_args.split(","):
                        pair = pair.strip()
                        if "=" in pair:
                            k, v = pair.split("=", 1)
                            attrs[k.strip()] = v.strip().strip("\"'")
                            if k.strip() == "value":
                                primary = attrs[k.strip()]
                else:
                    primary = raw_args.strip().strip("\"'")
            facts.annotations.append(
                AnnotationFact(
                    name=a_name,
                    target="class",
                    target_name=class_name,
                    file=file_str,
                    line=None,
                    attributes=attrs,
                    value=primary,
                )
            )
            if a_name == "Order":
                try:
                    facts.filter_orders[class_name] = int(primary) if primary else 0
                except (ValueError, TypeError):
                    pass


# ── Record-component validation extraction ──────────────────────────────────

_RECORD_RX = re.compile(
    r"public\s+record\s+(\w+)\s*\(", re.MULTILINE
)


def _extract_record_validations(
    text: str, file_str: str, facts: JavaFacts
) -> None:
    """javalang's record support is partial; supplement by scanning for
    @NotBlank / @Size / @NotNull / @NotEmpty on record components."""
    # Find each record declaration's parameter block
    for match in _RECORD_RX.finditer(text):
        record_name = match.group(1)
        # Find the matching closing ) at the same depth
        depth = 1
        i = match.end()
        n = len(text)
        while i < n and depth > 0:
            c = text[i]
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        params_block = text[match.end():i]
        # Split by commas at depth 0 (annotations like @Size(max=200) include commas)
        params = _split_params(params_block)
        for p in params:
            p_clean = p.strip()
            if not p_clean:
                continue
            # Each param is: <annotations...> <Type> <name>
            # Annotations start with @
            ann_re = re.compile(r"@(\w+)(?:\(([^)]*)\))?")
            anns = list(ann_re.finditer(p_clean))
            if not anns:
                continue
            # Find param name = last identifier
            tokens = p_clean.split()
            name = tokens[-1] if tokens else ""
            # strip trailing punctuation
            name = re.sub(r"[^\w]+$", "", name)
            for ann_match in anns:
                a_name = ann_match.group(1)
                if a_name in _VALIDATION_ANNOTATIONS:
                    raw_attrs = ann_match.group(2) or ""
                    attrs: dict[str, str] = {}
                    if raw_attrs:
                        for pair in raw_attrs.split(","):
                            pair = pair.strip()
                            if "=" in pair:
                                k, v = pair.split("=", 1)
                                attrs[k.strip()] = v.strip().strip("\"'")
                    facts.field_validations.append(
                        FieldValidationFact(
                            annotation=a_name,
                            field_name=name,
                            enclosing_class=record_name,
                            file=file_str,
                            line=None,
                            attributes=attrs,
                        )
                    )


def _split_params(s: str) -> list[str]:
    """Split a Java parameter list on commas at paren-depth 0."""
    out: list[str] = []
    depth = 0
    last = 0
    for i, c in enumerate(s):
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        elif c == "," and depth == 0:
            out.append(s[last:i])
            last = i + 1
    if last < len(s):
        out.append(s[last:])
    return out


# ── Public API ──────────────────────────────────────────────────────────────


def extract_facts(service_root: Path) -> JavaFacts:
    """Walk service_root/src/main/java and return aggregated JavaFacts."""
    facts = JavaFacts()
    java_root = service_root / "src" / "main" / "java"
    if not java_root.exists():
        # Fall back to scanning the whole tree for *.java
        java_root = service_root
    for java_file in sorted(java_root.rglob("*.java")):
        rel = str(java_file)
        try:
            text = java_file.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            facts.unparsed.append((rel, f"read error: {e}"))
            continue
        try:
            cu = javalang.parse.parse(text)
        except (javalang.parser.JavaSyntaxError, javalang.tokenizer.LexerError) as e:
            facts.unparsed.append((rel, f"parse error: {e}"))
            # Regex fallbacks — javalang 0.13 doesn't cover records, sealed
            # types, or Java 16+ pattern matching. Pick up class-level
            # annotations and record validations independently.
            _extract_class_annotations_via_regex(text, rel, facts)
            _extract_record_validations(text, rel, facts)
            continue
        except Exception as e:  # pragma: no cover - unexpected javalang state
            facts.unparsed.append((rel, f"unexpected error: {e}"))
            continue
        _extract_class_facts(cu, rel, facts)
        _extract_record_validations(text, rel, facts)
        facts.parsed_files.append(rel)
    return facts
