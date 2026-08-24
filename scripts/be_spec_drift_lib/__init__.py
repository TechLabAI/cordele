"""be_spec_drift_lib — helpers for scripts/be-spec-drift.py (D-160, PP v2 S5).

Three modules:

- java_ast.py     — Java AST extraction (annotations, endpoints, filter order,
                    exception handlers, validation, method calls)
- ears_parser.py  — EARS spec parser (Ubiquitous / Event / State / Optional /
                    Unwanted) with permissive grammar for real BOSQ specs
- comparator.py   — drift comparator engine; produces typed report rows

Read-only: this library is consumed by be-spec-drift.py and the smoke test;
it never writes user-facing files.
"""

from .ears_parser import EarsClause, parse_ears
from .java_ast import (
    AnnotationFact,
    EndpointFact,
    ExceptionHandlerFact,
    JavaFacts,
    MethodCallFact,
    extract_facts,
)

__all__ = [
    "AnnotationFact",
    "EarsClause",
    "EndpointFact",
    "ExceptionHandlerFact",
    "JavaFacts",
    "MethodCallFact",
    "extract_facts",
    "parse_ears",
]
