import ast
import fnmatch
import logging
import os
import re
from collections import deque
from typing import Dict, List, Optional, Set, Tuple

from app.schemas.code_quality import FileInput
from app.schemas.test_impact import DagEdge, ImpactedNode, TestImpactRequest, TestImpactResult

logger = logging.getLogger(__name__)


class TestImpactAnalyzer:
    """
    Constructs an in-memory dependency Directed Acyclic Graph (DAG) of the repository
    and computes transitive test impact closures via transposed graph (G^T) BFS traversal.
    """

    DEFAULT_TEST_PATTERNS = [
        "*.spec.ts", "*.spec.tsx", "*.spec.js", "*.spec.jsx",
        "*.test.ts", "*.test.tsx", "*.test.js", "*.test.jsx",
        "*_test.py", "test_*.py", "*_spec.rb", "*Test.java"
    ]

    def _is_test_file(self, path: str, patterns: Optional[List[str]] = None) -> bool:
        """Determine whether a file path represents an automated test suite."""
        patterns = patterns or self.DEFAULT_TEST_PATTERNS
        norm_path = path.replace("\\", "/").lower()
        basename = os.path.basename(norm_path)

        for pat in patterns:
            pat_lower = pat.lower()
            if fnmatch.fnmatch(basename, pat_lower) or fnmatch.fnmatch(norm_path, pat_lower):
                return True

        if any(seg in norm_path for seg in ["/test/", "/tests/", "/__tests__/"]):
            if basename.endswith(('.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go')):
                return True

        return False

    def _extract_file_imports(
        self,
        file: FileInput,
        all_paths: Set[str],
        normalized_map: Dict[str, str]
    ) -> Set[str]:
        """Extract imported module paths from Python and JS/TS source code."""
        imports: Set[str] = set()
        norm_caller_path = file.path.replace("\\", "/")
        caller_dir = os.path.dirname(norm_caller_path)

        # 1. Python AST parsing for imports
        if norm_caller_path.endswith(".py"):
            try:
                tree = ast.parse(file.content)
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            imports.add(alias.name)
                    elif isinstance(node, ast.ImportFrom):
                        if node.module:
                            imports.add(node.module)
            except Exception:
                pass
        else:
            # 2. JS/TS Lexical and AST import patterns
            import_patterns = [
                r'\b(?:import|require)\b.*?[\'"]([^\'"]+)[\'"]',
                r'\bfrom\s+[\'"]([^\'"]+)[\'"]',
                r'\bexport\s+.*?from\s+[\'"]([^\'"]+)[\'"]'
            ]
            for pat in import_patterns:
                for match in re.finditer(pat, file.content):
                    raw_specifier = match.group(1).strip()
                    imports.add(raw_specifier)

        # 3. Resolve imports to canonical file paths in repository
        resolved: Set[str] = set()
        for raw_imp in imports:
            resolved_target = self._resolve_import_path(raw_imp, caller_dir, all_paths, normalized_map)
            if resolved_target and resolved_target != norm_caller_path:
                resolved.add(resolved_target)

        return resolved

    def _resolve_import_path(
        self,
        specifier: str,
        caller_dir: str,
        all_paths: Set[str],
        normalized_map: Dict[str, str]
    ) -> Optional[str]:
        """Resolve a relative or absolute module import specifier to a concrete repository file path."""
        # Handle relative imports (e.g. "./auth.service", "../common/utils")
        if specifier.startswith("."):
            joined = os.path.normpath(os.path.join(caller_dir, specifier)).replace("\\", "/")
            # Test direct file extensions
            for ext in ["", ".ts", ".tsx", ".js", ".jsx", ".py"]:
                candidate = joined + ext
                if candidate in all_paths:
                    return candidate
            # Test directory index imports (e.g. "./auth" -> "./auth/index.ts")
            for idx_ext in ["/index.ts", "/index.tsx", "/index.js", "/index.jsx", "/__init__.py"]:
                candidate = joined + idx_ext
                if candidate in all_paths:
                    return candidate

        # Handle alias or root-relative imports (e.g. "@/services/billing" or "services.billing")
        clean_spec = specifier.replace("@/", "").replace("./", "").replace("../", "").replace("/", ".")
        clean_spec_slashes = specifier.replace("@/", "")

        # Exact match on stripped path
        for p in all_paths:
            p_clean = p.replace(".ts", "").replace(".tsx", "").replace(".js", "").replace(".jsx", "").replace(".py", "")
            if p_clean == clean_spec_slashes or p_clean.endswith("/" + clean_spec_slashes):
                return p

        # Dot notation match for Python / Java (e.g. "app.services.auth")
        if clean_spec in normalized_map:
            return normalized_map[clean_spec]
        for mod, path in normalized_map.items():
            if mod == clean_spec or mod.endswith("." + clean_spec) or clean_spec.endswith("." + mod):
                return path

        return None

    def build_dependency_dag(
        self,
        files: List[FileInput]
    ) -> Tuple[Dict[str, Set[str]], Dict[str, Set[str]]]:
        """
        Build the forward dependency graph G (caller -> callee)
        and transposed impact graph G^T (callee -> callers).
        """
        all_paths: Set[str] = {f.path.replace("\\", "/") for f in files}

        # Build normalized module mapping for dot-notation resolution
        normalized_map: Dict[str, str] = {}
        for f in files:
            norm_path = f.path.replace("\\", "/")
            stripped = norm_path
            for ext in [".ts", ".tsx", ".js", ".jsx", ".py", ".java"]:
                if stripped.endswith(ext):
                    stripped = stripped[:-len(ext)]
                    break
            dot_name = stripped.replace("/", ".")
            normalized_map[dot_name] = norm_path

        forward_graph: Dict[str, Set[str]] = {p: set() for p in all_paths}
        reverse_graph: Dict[str, Set[str]] = {p: set() for p in all_paths}

        for f in files:
            norm_path = f.path.replace("\\", "/")
            callees = self._extract_file_imports(f, all_paths, normalized_map)
            forward_graph[norm_path] = callees
            for callee in callees:
                if callee in reverse_graph:
                    reverse_graph[callee].add(norm_path)

        return forward_graph, reverse_graph

    def analyze(self, request: TestImpactRequest) -> TestImpactResult:
        """
        Perform Test Impact Analysis (TIA).
        Transversely navigates G^T from changed files to discover all impacted test suites.
        """
        files = request.files
        all_paths: Set[str] = {f.path.replace("\\", "/") for f in files}
        patterns = request.test_file_patterns or self.DEFAULT_TEST_PATTERNS

        # 1. Identify all test files currently in repository
        all_test_files: List[str] = sorted([p for p in all_paths if self._is_test_file(p, patterns)])

        # 2. Build forward graph and transposed impact graph
        forward_graph, reverse_graph = self.build_dependency_dag(files)

        # 3. Match requested changed_files to canonical repository paths
        canonical_changed: Set[str] = set()
        for c in request.changed_files:
            c_norm = c.replace("\\", "/")
            matched = None
            for p in all_paths:
                if p == c_norm or p.endswith("/" + c_norm) or c_norm.endswith("/" + p):
                    matched = p
                    break
            canonical_changed.add(matched or c_norm)

        # 4. BFS Traversal along transposed graph G^T
        queue = deque()
        visited: Set[str] = set()
        impacted_test_map: Dict[str, ImpactedNode] = {}

        for ch in sorted(canonical_changed):
            visited.add(ch)
            queue.append((ch, 0, [ch]))
            # If the changed file itself is a test suite, flag it immediately
            if self._is_test_file(ch, patterns):
                impacted_test_map[ch] = ImpactedNode(
                    file_path=ch,
                    depth=0,
                    impact_chain=[ch]
                )

        while queue:
            curr_file, depth, chain = queue.popleft()

            # Downstream consumers of curr_file
            dependents = reverse_graph.get(curr_file, set())
            for dep in sorted(dependents):
                if dep not in visited:
                    visited.add(dep)
                    new_chain = chain + [dep]

                    if self._is_test_file(dep, patterns):
                        impacted_test_map[dep] = ImpactedNode(
                            file_path=dep,
                            depth=depth + 1,
                            impact_chain=new_chain
                        )

                    # Continue propagating transitively through source files
                    queue.append((dep, depth + 1, new_chain))

        # 5. Partition tests into Impacted vs Skipped
        impacted_test_files: List[str] = sorted([
            t for t in all_test_files if t in impacted_test_map
        ])
        skipped_test_files: List[str] = sorted([
            t for t in all_test_files if t not in impacted_test_map
        ])

        total_tests = len(all_test_files)
        time_savings = (len(skipped_test_files) / float(total_tests) * 100.0) if total_tests > 0 else 0.0

        # 6. Format DAG edges for client visualization
        dag_edges = [
            DagEdge(source=u, target=v)
            for u in sorted(forward_graph.keys())
            for v in sorted(forward_graph[u])
        ]

        return TestImpactResult(
            changed_files=sorted(list(canonical_changed)),
            total_tests_in_repo=total_tests,
            impacted_tests_count=len(impacted_test_files),
            impacted_test_files=impacted_test_files,
            skipped_test_files=skipped_test_files,
            time_savings_percentage=round(time_savings, 1),
            impact_chains=[impacted_test_map[t] for t in impacted_test_files if t in impacted_test_map],
            dag_edges=dag_edges
        )


test_impact_analyzer = TestImpactAnalyzer()
