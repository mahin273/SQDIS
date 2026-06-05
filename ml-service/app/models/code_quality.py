import ast
import re
import math
import hashlib
import logging
from typing import List, Dict, Tuple, Optional
from app.schemas.code_quality import (
    CodeAnalysisRequest, CodeAnalysisResult, ComplexityResult,
    DuplicateBlock, SecurityIssue, OwnershipResult, HotspotResult,
    CodeSmell, DependencyCycle, SemanticClone, TaintIssue,
    JITCommitRisk, KnowledgeSiloGraph, FileInput, CommitInfo
)


logger = logging.getLogger(__name__)


class PythonComplexityVisitor(ast.NodeVisitor):
    """AST visitor to calculate Cyclomatic Complexity and Cognitive Complexity for Python code."""

    def __init__(self):
        self.cyclomatic_complexity = 1  # Base complexity is 1
        self.cognitive_complexity = 0
        self.nesting_level = 0
        self.operators_count = 0
        self.operands_count = 0
        self.unique_operators = set()
        self.unique_operands = set()

    def _increase_nesting(self):
        self.nesting_level += 1

    def _decrease_nesting(self):
        self.nesting_level -= 1

    def visit_If(self, node):
        self.cyclomatic_complexity += 1
        self.cognitive_complexity += 1 + self.nesting_level
        self._increase_nesting()
        self.generic_visit(node)
        self._decrease_nesting()

    def visit_For(self, node):
        self.cyclomatic_complexity += 1
        self.cognitive_complexity += 1 + self.nesting_level
        self._increase_nesting()
        self.generic_visit(node)
        self._decrease_nesting()

    def visit_While(self, node):
        self.cyclomatic_complexity += 1
        self.cognitive_complexity += 1 + self.nesting_level
        self._increase_nesting()
        self.generic_visit(node)
        self._decrease_nesting()

    def visit_AsyncFor(self, node):
        self.cyclomatic_complexity += 1
        self.cognitive_complexity += 1 + self.nesting_level
        self._increase_nesting()
        self.generic_visit(node)
        self._decrease_nesting()

    def visit_ExceptHandler(self, node):
        self.cyclomatic_complexity += 1
        self.cognitive_complexity += 1 + self.nesting_level
        self._increase_nesting()
        self.generic_visit(node)
        self._decrease_nesting()

    def visit_BoolOp(self, node):
        # Decision points in boolean logic (and, or)
        self.cyclomatic_complexity += len(node.values) - 1
        self.cognitive_complexity += len(node.values) - 1
        self.generic_visit(node)

    def visit_comprehension(self, node):
        self.cyclomatic_complexity += 1
        self.generic_visit(node)

    # Count Halstead operators/operands for Maintainability Index
    def visit_BinOp(self, node):
        op_name = type(node.op).__name__
        self.operators_count += 1
        self.unique_operators.add(op_name)
        self.generic_visit(node)

    def visit_Compare(self, node):
        for op in node.ops:
            op_name = type(op).__name__
            self.operators_count += 1
            self.unique_operators.add(op_name)
        self.generic_visit(node)

    def visit_Name(self, node):
        self.operands_count += 1
        self.unique_operands.add(node.id)
        self.generic_visit(node)

    def visit_Constant(self, node):
        self.operands_count += 1
        self.unique_operands.add(str(node.value))
        self.generic_visit(node)


class PythonLCOM4Visitor(ast.NodeVisitor):
    """AST visitor to calculate LCOM4 (Lack of Cohesion in Methods) and CBO (Coupling Between Objects) for Python classes."""

    def __init__(self):
        self.classes = []

    def visit_ClassDef(self, node):
        methods = []
        method_attributes = {}  # method_name -> set of self.attr
        method_calls = {}       # method_name -> set of self.method

        # Find all methods and their body variables
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                method_name = item.name
                methods.append(method_name)
                method_attributes[method_name] = set()
                method_calls[method_name] = set()

                class MethodDetailVisitor(ast.NodeVisitor):
                    def __init__(self):
                        self.accessed_attrs = set()
                        self.called_methods = set()

                    def visit_Attribute(self, subnode):
                        if isinstance(subnode.value, ast.Name) and subnode.value.id == 'self':
                            self.accessed_attrs.add(subnode.attr)
                        self.generic_visit(subnode)

                    def visit_Call(self, subnode):
                        if isinstance(subnode.func, ast.Attribute) and isinstance(subnode.func.value, ast.Name) and subnode.func.value.id == 'self':
                            self.called_methods.add(subnode.func.attr)
                        self.generic_visit(subnode)

                visitor = MethodDetailVisitor()
                visitor.visit(item)
                method_attributes[method_name] = visitor.accessed_attrs
                method_calls[method_name] = visitor.called_methods

        # Calculate LCOM4 components
        adj = {m: set() for m in methods}
        for m1 in methods:
            for m2 in methods:
                if m1 == m2:
                    continue
                # Connected if they share attributes
                shared_attrs = method_attributes[m1].intersection(method_attributes[m2])
                if shared_attrs:
                    adj[m1].add(m2)
                    adj[m2].add(m1)
                # Connected if m1 calls m2 or m2 calls m1
                if m2 in method_calls[m1] or m1 in method_calls[m2]:
                    adj[m1].add(m2)
                    adj[m2].add(m1)

        # Find connected components using BFS/DFS
        visited = set()
        components = 0
        for m in methods:
            if m not in visited:
                components += 1
                queue = [m]
                visited.add(m)
                while queue:
                    curr = queue.pop(0)
                    for neighbor in adj[curr]:
                        if neighbor not in visited:
                            visited.add(neighbor)
                            queue.append(neighbor)

        # LCOM4 is the number of connected components
        lcom4_val = components if methods else 1

        # Calculate CBO (Coupling Between Objects)
        class CBOVisitor(ast.NodeVisitor):
            def __init__(self):
                self.referenced_names = set()

            def visit_Name(self, subnode):
                self.referenced_names.add(subnode.id)
                self.generic_visit(subnode)
                
            def visit_Attribute(self, subnode):
                attr_path = []
                curr = subnode
                while isinstance(curr, ast.Attribute):
                    attr_path.append(curr.attr)
                    curr = curr.value
                if isinstance(curr, ast.Name):
                    attr_path.append(curr.id)
                    self.referenced_names.add(".".join(reversed(attr_path)))
                self.generic_visit(subnode)

        cbo_visitor = CBOVisitor()
        cbo_visitor.visit(node)
        
        standard_builtins = {'self', 'str', 'int', 'float', 'dict', 'list', 'set', 'tuple', 'bool', 'None', 'object', 'Exception', 'print', 'len', 'range', 'enumerate', 'zip'}
        referenced_classes = {name for name in cbo_visitor.referenced_names if name not in standard_builtins and not name.startswith('_') and name != node.name}
        cbo_val = len(referenced_classes)

        self.classes.append({
            "name": node.name,
            "lcom4": lcom4_val,
            "cbo": cbo_val,
            "methods_count": len(methods),
            "lineno": node.lineno
        })
        self.generic_visit(node)



class CodeSmellVisitor(ast.NodeVisitor):
    """AST visitor to detect code smells (God Class, Feature Envy, Long Parameter List, Deep Nesting) in Python code."""

    def __init__(self, file_path):
        self.file_path = file_path
        self.smells = []
        self.current_class = None

    def visit_ClassDef(self, node):
        prev_class = self.current_class
        self.current_class = node
        
        # Calculate lines of code for the class
        loc = node.end_lineno - node.lineno + 1 if hasattr(node, 'end_lineno') else 100
        
        # Count methods
        methods = [item for item in node.body if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef))]
        methods_count = len(methods)

        # If class has large size and many methods, flag as God Class
        if loc > 150 and methods_count > 8:
            self.smells.append(CodeSmell(
                file_path=self.file_path,
                smell_type="God Class",
                location=f"Class {node.name} (Lines {node.lineno}-{node.end_lineno if hasattr(node, 'end_lineno') else node.lineno})",
                description=f"Class '{node.name}' has too many responsibilities (LOC={loc}, methods={methods_count}). Consider refactoring it into smaller, cohesive classes.",
                severity="ERROR"
            ))

        self.generic_visit(node)
        self.current_class = prev_class

    def visit_FunctionDef(self, node):
        self.check_function_smells(node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node):
        self.check_function_smells(node)
        self.generic_visit(node)

    def check_function_smells(self, node):
        # 1. Long Parameter List
        params_count = len(node.args.args)
        if params_count > 5:
            self.smells.append(CodeSmell(
                file_path=self.file_path,
                smell_type="Long Parameter List",
                location=f"Function {node.name}() (Line {node.lineno})",
                description=f"Function '{node.name}' has {params_count} parameters. A long parameter list makes code harder to read and test. Consider passing an object/dict or splitting.",
                severity="WARNING"
            ))

        # 2. Deep Nesting & Feature Envy (requires traversal)
        class FunctionBodyVisitor(ast.NodeVisitor):
            def __init__(self):
                self.max_nesting = 0
                self.current_nesting = 0
                self.self_accesses = 0
                self.external_accesses = 0

            def visit_If(self, subnode):
                self.current_nesting += 1
                self.max_nesting = max(self.max_nesting, self.current_nesting)
                self.generic_visit(subnode)
                self.current_nesting -= 1

            def visit_For(self, subnode):
                self.current_nesting += 1
                self.max_nesting = max(self.max_nesting, self.current_nesting)
                self.generic_visit(subnode)
                self.current_nesting -= 1

            def visit_While(self, subnode):
                self.current_nesting += 1
                self.max_nesting = max(self.max_nesting, self.current_nesting)
                self.generic_visit(subnode)
                self.current_nesting -= 1

            def visit_Attribute(self, subnode):
                if isinstance(subnode.value, ast.Name):
                    if subnode.value.id == 'self':
                        self.self_accesses += 1
                    else:
                        self.external_accesses += 1
                self.generic_visit(subnode)

        body_visitor = FunctionBodyVisitor()
        body_visitor.visit(node)

        # Nesting smell
        if body_visitor.max_nesting > 3:
            self.smells.append(CodeSmell(
                file_path=self.file_path,
                smell_type="Deep Nesting",
                location=f"Function {node.name}() (Line {node.lineno})",
                description=f"Function '{node.name}' has a nesting level of {body_visitor.max_nesting}. Deeply nested control flows are hard to maintain.",
                severity="WARNING"
            ))

        # Feature Envy smell
        if self.current_class and body_visitor.external_accesses > 4 and body_visitor.self_accesses < 2:
            self.smells.append(CodeSmell(
                file_path=self.file_path,
                smell_type="Feature Envy",
                location=f"Method {self.current_class.name}.{node.name}() (Line {node.lineno})",
                description=f"Method '{node.name}' accesses attributes on other objects ({body_visitor.external_accesses}) more than its own class attributes ({body_visitor.self_accesses}). It might belong in the other class.",
                severity="LOW"
            ))


class PythonTaintTracker(ast.NodeVisitor):
    """AST visitor to track taint propagation from input sources to dangerous query/execution sinks."""

    def __init__(self, file_path):
        self.file_path = file_path
        self.tainted_vars = set()
        self.issues = []
        
        # Sources
        self.sources = {
            'input', 'request.args', 'request.json', 'request.form', 
            'request.values', 'request.data', 'request.get_json', 
            'request.body', 'params', 'query_params'
        }
        # Sinks
        self.sinks = {
            'execute', 'query', 'eval', 'exec', 
            'subprocess.Popen', 'subprocess.run', 'os.system'
        }
        # Sanitizers
        self.sanitizers = {'int', 'float', 'escape', 'sanitize', 'str_to_int', 'int_to_str'}

    def _is_source(self, node):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in self.sources:
            return True, node.func.id
        
        source_attr = self._get_attribute_path(node)
        for src in self.sources:
            if source_attr and (source_attr == src or source_attr.startswith(src + ".")):
                return True, source_attr
        return False, None

    def _get_attribute_path(self, node):
        if isinstance(node, ast.Attribute):
            val_path = self._get_attribute_path(node.value)
            if val_path:
                return f"{val_path}.{node.attr}"
            return node.attr
        elif isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Call):
            return self._get_attribute_path(node.func)
        return None

    def _contains_taint(self, node):
        if isinstance(node, ast.Name) and node.id in self.tainted_vars:
            return True
        for subnode in ast.walk(node):
            if isinstance(subnode, ast.Name) and subnode.id in self.tainted_vars:
                # Check if this name is inside a sanitizer call within node
                parent = self._get_parent_call(subnode, node)
                if parent and isinstance(parent.func, ast.Name) and parent.func.id in self.sanitizers:
                    continue
                return True
        return False

    def _get_parent_call(self, child_node, root_node):
        for node in ast.walk(root_node):
            if isinstance(node, ast.Call):
                for arg in node.args:
                    if arg == child_node:
                        return node
        return None

    def visit_Assign(self, node):
        is_src, src_name = self._is_source(node.value)
        if is_src:
            for target in node.targets:
                if isinstance(target, ast.Name):
                    self.tainted_vars.add(target.id)
        elif self._contains_taint(node.value):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    self.tainted_vars.add(target.id)
        else:
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in self.tainted_vars:
                    self.tainted_vars.discard(target.id)
        self.generic_visit(node)

    def visit_Call(self, node):
        func_path = self._get_attribute_path(node.func)
        if func_path:
            is_sink = False
            for sink in self.sinks:
                if func_path == sink or func_path.endswith("." + sink):
                    is_sink = True
                    break
            
            if is_sink:
                for arg in node.args:
                    if self._contains_taint(arg):
                        var_name = self._find_tainted_var_name(arg)
                        self.issues.append(TaintIssue(
                            path=self.file_path,
                            source="User Input Source",
                            sink=f"Dangerous Sink API ({func_path})",
                            line_number=node.lineno,
                            variable_name=var_name,
                            message=f"SQL/Command injection vulnerability: untrusted variable '{var_name}' propagates unchecked from input to database/shell command execution.",
                            severity="CRITICAL"
                        ))
        self.generic_visit(node)

    def _find_tainted_var_name(self, node):
        if isinstance(node, ast.Name) and node.id in self.tainted_vars:
            return node.id
        for subnode in ast.walk(node):
            if isinstance(subnode, ast.Name) and subnode.id in self.tainted_vars:
                return subnode.id
        return "unresolved_variable"


class CodeQualityAnalyzer:

    """Core analysis engine for parsing code complexity, security, duplication, ownership, and hotspots."""

    # SAST and Secret Scanning regex rules
    SECURITY_RULES = [
        # 1. SQL Injection Risk
        {
            "id": "sql-injection",
            "type": "sast",
            "severity": "HIGH",
            "pattern": r"(execute|query|select|db_query)\s*\(.*([%+].*|f\".*\{.*\}.*\")",
            "message": "Potential SQL injection vulnerability: raw string formatting detected inside database execute command."
        },
        # 2. Dangerous Executions
        {
            "id": "eval-exec",
            "type": "sast",
            "severity": "CRITICAL",
            "pattern": r"\b(eval|exec|subprocess\.Popen|subprocess\.run)\s*\(.*(shell\s*=\s*True|compile|\bsh\b|\bbash\b)",
            "message": "Potential Remote Code Execution (RCE) risk: shell evaluation or dynamic command execution detected."
        },
        # 3. Weak Cryptography
        {
            "id": "weak-crypto",
            "type": "sast",
            "severity": "MEDIUM",
            "pattern": r"\b(hashlib\.md5|hashlib\.sha1|MD5|SHA1)\b",
            "message": "Insecure cryptographic hashing algorithm (MD5/SHA-1) detected. Use SHA-256 or bcrypt instead."
        },
        # 4. Insecure Host Binding
        {
            "id": "insecure-binding",
            "type": "sast",
            "severity": "MEDIUM",
            "pattern": r"['\"]0\.0\.0\.0['\"]",
            "message": "Insecure network binding: server binds to all available network interfaces ('0.0.0.0')."
        },
        # 5. Secrets: Private Key Leaks
        {
            "id": "private-key",
            "type": "secret",
            "severity": "CRITICAL",
            "pattern": r"-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----",
            "message": "Private key leakage detected. Never commit cryptographic private keys to git repositories."
        },
        # 6. Secrets: Slack incoming webhooks
        {
            "id": "slack-webhook",
            "type": "secret",
            "severity": "CRITICAL",
            "pattern": r"https://hooks\.slack\.com/services/T[A-Z0-9_]{8}/B[A-Z0-9_]{8}/[A-Za-z0-9_]{24}",
            "message": "Slack Incoming Webhook URL exposed."
        },
        # 7. Secrets: Generic AWS/OAuth Token Patterns
        {
            "id": "generic-token",
            "type": "secret",
            "severity": "CRITICAL",
            "pattern": r"\b(aws_access_key_id|aws_secret_access_key|api_key|secret_key|jwt_secret|oauth_token)\b\s*=\s*['\"][A-Za-z0-9+/=_\-\.]{16,}['\"]",
            "message": "Hardcoded credential/API token detected."
        }
    ]

    def _calculate_python_complexity(self, content: str, path: str) -> ComplexityResult:
        """Parse Python AST to compute precise Cyclomatic and Cognitive complexities."""
        # Estimate LOC (exclude blanks and comments)
        lines = [line.strip() for line in content.splitlines() if line.strip() and not line.strip().startswith("#")]
        loc = max(1, len(lines))

        try:
            tree = ast.parse(content)
            visitor = PythonComplexityVisitor()
            visitor.visit(tree)

            cc = visitor.cyclomatic_complexity
            cog = visitor.cognitive_complexity

            # Halstead Volume estimation
            n1 = len(visitor.unique_operators)
            n2 = len(visitor.unique_operands)
            N1 = visitor.operators_count
            N2 = visitor.operands_count
            
            vocab = n1 + n2
            length = N1 + N2
            
            if vocab > 0 and length > 0:
                volume = length * math.log2(vocab)
            else:
                volume = 1.0

            # Maintainability Index (MI) formula:
            # MI = 171 - 5.2 * ln(Volume) - 0.23 * CC - 16.2 * ln(LOC)
            mi = 171.0 - (5.2 * math.log(max(1.0, volume))) - (0.23 * cc) - (16.2 * math.log(loc))
            # Normalize to 0-100
            mi = max(0.0, min(100.0, mi))

            return ComplexityResult(
                path=path,
                cyclomatic_complexity=cc,
                cognitive_complexity=cog,
                maintainability_index=round(mi, 2),
                duplicate_blocks=[]
            )
        except Exception as e:
            logger.warning(f"AST parsing failed for {path}: {e}. Falling back to lexical scan.")
            return self._calculate_lexical_complexity(content, path)

    def _calculate_lexical_complexity(self, content: str, path: str) -> ComplexityResult:
        """Fallback lexical complexity parser using regex counting (for non-Python or broken files)."""
        lines = [line.strip() for line in content.splitlines() if line.strip() and not line.strip().startswith(("//", "#", "/*", "*"))]
        loc = max(1, len(lines))

        # Count decision keywords
        decision_patterns = [
            r"\b(if|for|while|catch|switch|case)\b",
            r"\b(&&|\|\|)\b"
        ]
        
        cc = 1
        for pat in decision_patterns:
            matches = re.findall(pat, content)
            cc += len(matches)

        # Estimate nesting depth via brace counts
        cog = 0
        nesting = 0
        for line in content.splitlines():
            line_str = line.strip()
            if "{" in line_str:
                nesting += 1
            if "}" in line_str:
                nesting = max(0, nesting - 1)
            
            # If line has conditional and is nested
            if re.search(r"\b(if|for|while|catch)\b", line_str):
                cog += 1 + nesting

        # Estimate Halstead volume based on tokens count
        words = len(re.findall(r"\w+", content))
        volume = max(1.0, words * 4.5)  # Quick approximation

        # Maintainability Index
        mi = 171.0 - (5.2 * math.log(volume)) - (0.23 * cc) - (16.2 * math.log(loc))
        mi = max(0.0, min(100.0, mi))

        return ComplexityResult(
            path=path,
            cyclomatic_complexity=cc,
            cognitive_complexity=cog,
            maintainability_index=round(mi, 2),
            duplicate_blocks=[]
        )

    def _scan_duplicates(self, files: List[FileInput]) -> Dict[str, List[DuplicateBlock]]:
        """Identify copy-pasted blocks of code (minimum 6 matching lines) across all input files."""
        duplicates_map: Dict[str, List[DuplicateBlock]] = {f.path: [] for f in files}
        block_size = 6
        hashes = {}

        for f in files:
            lines = [line.strip() for line in f.content.splitlines()]
            
            # Slide window across lines of file
            for i in range(len(lines) - block_size + 1):
                # Grab a window of non-blank lines
                window_lines = [lines[i+j] for j in range(block_size) if lines[i+j]]
                if len(window_lines) < block_size - 2:
                    continue  # Ignore mostly empty blocks

                block_text = "".join(window_lines).replace(" ", "").replace("\t", "")
                if len(block_text) < 30:
                    continue  # Ignore tiny blocks (like consecutive braces)

                block_hash = hashlib.md5(block_text.encode("utf-8")).hexdigest()

                if block_hash in hashes:
                    match = hashes[block_hash]
                    # Avoid self-matching
                    if match["path"] != f.path:
                        snippet = "\n".join(lines[i:i+block_size])
                        duplicates_map[f.path].append(DuplicateBlock(
                            matching_file=match["path"],
                            start_line=i + 1,
                            line_count=block_size,
                            snippet=snippet
                        ))
                else:
                    hashes[block_hash] = {
                        "path": f.path,
                        "line": i + 1
                    }

        return duplicates_map

    def _scan_security(self, files: List[FileInput]) -> List[SecurityIssue]:
        """Scan code files for security risks and secrets exposure."""
        issues = []

        for f in files:
            lines = f.content.splitlines()
            for line_idx, line in enumerate(lines):
                line_str = line.strip()
                # Skip comments
                if line_str.startswith(("#", "//", "*")):
                    continue

                for rule in self.SECURITY_RULES:
                    if re.search(rule["pattern"], line, re.IGNORECASE if rule["type"] == "sast" else 0):
                        issues.append(SecurityIssue(
                            path=f.path,
                            type=rule["type"],
                            severity=rule["severity"],
                            message=rule["message"],
                            line_number=line_idx + 1
                        ))

        return issues

    def _analyze_ownership(
        self,
        files: List[FileInput],
        git_history: Optional[List[CommitInfo]]
    ) -> List[OwnershipResult]:
        """Analyze commit distributions to calculate Bus Factor and identify knowledge silos."""
        ownership_list = []
        if not git_history:
            # Fallback when no git history is provided
            for f in files:
                ownership_list.append(OwnershipResult(
                    path=f.path,
                    bus_factor=1,
                    primary_author="unknown@example.com",
                    author_distribution={"unknown@example.com": 1.0}
                ))
            return ownership_list

        # Compile commit authors per file
        file_authors: Dict[str, Dict[str, int]] = {}
        for f in files:
            file_authors[f.path] = {}

        for commit in git_history:
            author = commit.author_email
            for change in commit.files_changed:
                if change.path in file_authors:
                    file_authors[change.path][author] = file_authors[change.path].get(author, 0) + 1

        for f in files:
            authors_commits = file_authors[f.path]
            if not authors_commits:
                ownership_list.append(OwnershipResult(
                    path=f.path,
                    bus_factor=1,
                    primary_author="unknown@example.com",
                    author_distribution={"unknown@example.com": 1.0}
                ))
                continue

            total_commits = sum(authors_commits.values())
            
            # Sort authors by commit count descending
            sorted_authors = sorted(authors_commits.items(), key=lambda x: x[1], reverse=True)
            primary_author = sorted_authors[0][0]

            # Calculate distribution ratios
            distribution = {auth: round(count / total_commits, 3) for auth, count in sorted_authors}

            # Calculate Bus Factor: min authors needed to own > 80% of commits
            cumulative_ratio = 0.0
            bus_factor = 0
            for auth, count in sorted_authors:
                cumulative_ratio += count / total_commits
                bus_factor += 1
                if cumulative_ratio >= 0.8:
                    break

            ownership_list.append(OwnershipResult(
                path=f.path,
                bus_factor=bus_factor,
                primary_author=primary_author,
                author_distribution=distribution
            ))

        return ownership_list

    def _detect_hotspots(
        self,
        complexity_results: List[ComplexityResult],
        ownership_results: List[OwnershipResult],
        git_history: Optional[List[CommitInfo]],
        coverage_metadata: Optional[Dict[str, float]]
    ) -> List[HotspotResult]:
        """Correlate complexity, churn (commit frequency), and test coverage to isolate hotspots."""
        hotspots = []
        
        # Calculate file churn (commits count per file)
        file_churn: Dict[str, int] = {c.path: 0 for c in complexity_results}
        if git_history:
            for commit in git_history:
                for change in commit.files_changed:
                    if change.path in file_churn:
                        file_churn[change.path] += 1

        # Evaluate each file
        for idx, comp in enumerate(complexity_results):
            path = comp.path
            cc = comp.cyclomatic_complexity
            mi = comp.maintainability_index
            churn = file_churn[path]
            
            # Resolve test coverage (default: 100% if no metadata provided)
            coverage = 100.0
            if coverage_metadata:
                coverage = coverage_metadata.get(path, 0.0)

            # Hotspot score calculation (0-100 scale)
            # Complexity score (max 40)
            comp_score = min(cc / 15.0, 1.0) * 40.0
            # Churn score (max 30)
            churn_score = min(churn / 12.0, 1.0) * 30.0
            # Coverage score (max 30)
            cov_score = (1.0 - (coverage / 100.0)) * 30.0

            hotspot_score = comp_score + churn_score + cov_score
            hotspot_score = round(max(0.0, min(100.0, hotspot_score)), 2)

            # Compile reasons
            reasons = []
            if cc > 10:
                reasons.append(f"High code complexity (McCabe CC={cc})")
            if mi < 50:
                reasons.append(f"Low Maintainability Index (MI={mi:.1f})")
            if churn > 8:
                reasons.append(f"High modification churn ({churn} commits in history)")
            if coverage < 60.0:
                reasons.append(f"Poor test coverage ({coverage:.1f}%)")

            # Flag as hotspot if score is high and has multiple risk factors
            if hotspot_score > 55.0 and len(reasons) >= 2:
                hotspots.append(HotspotResult(
                    path=path,
                    hotspot_score=hotspot_score,
                    reasons=reasons
                ))

        # Sort hotspots by score descending
        return sorted(hotspots, key=lambda x: x.hotspot_score, reverse=True)

    def _detect_semantic_clones(self, files: List[FileInput]) -> List[SemanticClone]:
        """Detect high semantic similarity between files using TF-IDF and Cosine Similarity."""
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity

        if len(files) < 2:
            return []

        # Prepare corpus: code files
        corpus = [f.content for f in files]
        paths = [f.path for f in files]

        # Use a custom token pattern suitable for code (split on words, keep keywords and identifiers)
        vectorizer = TfidfVectorizer(token_pattern=r"(?u)\b\w+\b")
        try:
            tfidf_matrix = vectorizer.fit_transform(corpus)
            similarity_matrix = cosine_similarity(tfidf_matrix, tfidf_matrix)

            clones = []
            n_files = len(files)
            # We only need upper triangle to avoid duplicating pairs like (A, B) and (B, A)
            for i in range(n_files):
                for j in range(i + 1, n_files):
                    score = float(similarity_matrix[i, j])
                    if score > 0.85:
                        clones.append(SemanticClone(
                            file_a=paths[i],
                            file_b=paths[j],
                            similarity_score=round(score, 3),
                            description=f"High semantic similarity ({round(score * 100, 1)}%) detected. Code structures are highly matching, suggesting potential logic duplication."
                        ))
            return clones
        except Exception as e:
            logger.warning(f"Semantic clone detection failed: {e}")
            return []

    def _detect_dependency_cycles(self, files: List[FileInput]) -> List[DependencyCycle]:
        """Parse file import references and detect circular dependencies (cycles)."""
        import_graph = {}
        path_to_module = {}
        for f in files:
            # Normalize path delimiters
            normalized_path = f.path.replace("\\", "/")
            clean_path = normalized_path.replace(".py", "").replace(".js", "").replace(".ts", "").replace(".tsx", "").replace("/", ".")
            path_to_module[clean_path] = f.path
            
        for f in files:
            imports = set()
            normalized_path = f.path.replace("\\", "/")
            if normalized_path.endswith(".py"):
                try:
                    tree = ast.parse(f.content)
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
                # Lexical scan for JS/TS import patterns
                import_patterns = [
                    r'\b(?:import|require)\b.*?[\'"]([^\'"]+)[\'"]',
                    r'\bfrom\s+[\'"]([^\'"]+)[\'"]'
                ]
                for pat in import_patterns:
                    for match in re.finditer(pat, f.content):
                        imp_path = match.group(1)
                        # Clean up relative dots
                        imp_path = imp_path.replace("./", "").replace("../", "").replace("/", ".")
                        imports.add(imp_path)

            resolved_imports = set()
            for imp in imports:
                for mod, p in path_to_module.items():
                    if mod == imp or mod.endswith("." + imp) or imp.endswith("." + mod):
                        if p != f.path:
                            resolved_imports.add(p)
                            
            import_graph[f.path] = list(resolved_imports)

        cycles = []
        visited = {}  # path -> state (0=unvisited, 1=visiting, 2=visited)
        path_stack = []

        def dfs(node):
            visited[node] = 1
            path_stack.append(node)

            for neighbor in import_graph.get(node, []):
                if visited.get(neighbor, 0) == 1:
                    cycle_index = path_stack.index(neighbor)
                    cycle_path = path_stack[cycle_index:] + [neighbor]
                    cycles.append(DependencyCycle(
                        files=cycle_path,
                        description=f"Circular dependency cycle detected: {' -> '.join(cycle_path)}"
                    ))
                elif visited.get(neighbor, 0) == 0:
                    dfs(neighbor)

            path_stack.pop()
            visited[node] = 2

        for f in files:
            if visited.get(f.path, 0) == 0:
                dfs(f.path)

        return cycles

    def _scan_code_smells(self, files: List[FileInput]) -> List[CodeSmell]:
        """Scan code files for architecture/structural smells using AST and lexical rules."""
        smells = []
        for f in files:
            if f.path.endswith(".py"):
                try:
                    tree = ast.parse(f.content)
                    visitor = CodeSmellVisitor(f.path)
                    visitor.visit(tree)
                    smells.extend(visitor.smells)
                    
                    # Run LCOM4 & CBO visitor
                    lcom_visitor = PythonLCOM4Visitor()
                    lcom_visitor.visit(tree)
                    for cls in lcom_visitor.classes:
                        class_name = cls["name"]
                        lcom4_val = cls["lcom4"]
                        cbo_val = cls["cbo"]
                        lineno = cls["lineno"]
                        
                        if lcom4_val > 1:
                            smells.append(CodeSmell(
                                file_path=f.path,
                                smell_type="Lack of Cohesion (LCOM4)",
                                location=f"Class {class_name} (Line {lineno})",
                                description=f"Class '{class_name}' has an LCOM4 value of {lcom4_val}. It contains {lcom4_val} disjoint method sets, suggesting it should be split to respect Single Responsibility.",
                                severity="WARNING"
                            ))
                            
                        if cbo_val > 6:
                            smells.append(CodeSmell(
                                file_path=f.path,
                                smell_type="High Coupling (CBO)",
                                location=f"Class {class_name} (Line {lineno})",
                                description=f"Class '{class_name}' has a CBO score of {cbo_val}. It is coupled to {cbo_val} other classes/modules. Consider introducing interfaces to reduce coupling.",
                                severity="WARNING"
                            ))
                except Exception as e:
                    logger.warning(f"AST-based code smell scan failed for {f.path}: {e}")
            else:
                # Lexical scan fallback for JS/TS/etc.
                params_pat = r'function\s+\w+\s*\(([^)]+)\)'
                for match in re.finditer(params_pat, f.content):
                    args = match.group(1).split(",")
                    if len(args) > 5:
                        smells.append(CodeSmell(
                            file_path=f.path,
                            smell_type="Long Parameter List",
                            location=f"Function parameters (around line {f.content[:match.start()].count('\n') + 1})",
                            description=f"Function has {len(args)} parameters. A long parameter list makes code harder to read and test.",
                            severity="WARNING"
                        ))
                loc = len(f.content.splitlines())
                if loc > 300:
                    smells.append(CodeSmell(
                        file_path=f.path,
                        smell_type="God File",
                        location=f"File scope",
                        description=f"File is very large (LOC={loc}). Consider splitting it into smaller, more modular files.",
                        severity="WARNING"
                    ))
        return smells

    def _run_taint_analysis(self, files: List[FileInput]) -> List[TaintIssue]:
        """Trace variables in Python AST to find potential taint injection risks."""
        issues = []
        for f in files:
            if f.path.endswith(".py"):
                try:
                    tree = ast.parse(f.content)
                    tracker = PythonTaintTracker(f.path)
                    tracker.visit(tree)
                    issues.extend(tracker.issues)
                except Exception as e:
                    logger.warning(f"Taint analysis failed for {f.path}: {e}")
        return issues

    def _analyze_jit_commit_risk(self, git_history: Optional[List[CommitInfo]]) -> List[JITCommitRisk]:
        """Assess risk score for each commit in git history using size, developer experience, and message sentiment."""
        if not git_history:
            return []

        # Calculate author experience counts and file churn history
        author_commits = {}
        file_churn_counts = {}
        for commit in git_history:
            author = commit.author_email
            author_commits[author] = author_commits.get(author, 0) + 1
            for f in commit.files_changed:
                file_churn_counts[f.path] = file_churn_counts.get(f.path, 0) + 1

        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        sia = SentimentIntensityAnalyzer()

        jit_risks = []
        for commit in git_history:
            sha = commit.sha
            author = commit.author_email
            files_touched = commit.files_changed
            message = commit.message

            # 1. Churn Scatter (Spread)
            n_files = len(files_touched)
            scatter_score = min(n_files * 4.0, 25.0)

            # 2. Author Experience Risk
            total_auth_commits = author_commits.get(author, 1)
            experience_score = max(0.0, 25.0 - (total_auth_commits * 4.0))

            # 3. File Churn Risk
            max_file_churn = 0
            for f in files_touched:
                max_file_churn = max(max_file_churn, file_churn_counts.get(f.path, 1))
            churn_score = min(max_file_churn * 3.0, 25.0)

            # 4. Message Sentiment & Urgency
            sentiment_score = 0.0
            risk_factors = []

            if message:
                try:
                    scores = sia.polarity_scores(message)
                    compound = scores['compound']
                    if compound < -0.1:
                        sentiment_score += abs(compound) * 15.0
                        risk_factors.append("Negative or urgent commit message sentiment")
                except Exception:
                    pass

                # Check urgency / panic words
                urgency_words = re.findall(r'\b(panic|hotfix|temp|workaround|hack|cleanup|merge|skip|disable|remove)\b', message, re.IGNORECASE)
                if urgency_words:
                    sentiment_score += min(len(urgency_words) * 5.0, 10.0)
                    risk_factors.append(f"Urgent/patch keywords detected: {', '.join(set(urgency_words))}")

                if len(message.strip()) < 10:
                    sentiment_score += 5.0
                    risk_factors.append("Extremely short or vague commit message")
            else:
                sentiment_score += 5.0
                risk_factors.append("Missing commit message metadata")

            if n_files > 5:
                risk_factors.append(f"High churn scatter: modified {n_files} files in one commit")
            if total_auth_commits < 4:
                risk_factors.append("Inexperienced author: author has few commits in project history")
            if max_file_churn > 6:
                risk_factors.append("High-risk file modifications: edits files with high historical churn")

            total_risk = scatter_score + experience_score + churn_score + sentiment_score
            total_risk = round(max(0.0, min(100.0, total_risk)), 2)

            jit_risks.append(JITCommitRisk(
                sha=sha,
                risk_score=total_risk,
                risk_factors=risk_factors,
                author_email=author
            ))

        return sorted(jit_risks, key=lambda x: x.risk_score, reverse=True)

    def _analyze_knowledge_decay(
        self,
        files: List[FileInput],
        git_history: Optional[List[CommitInfo]],
        ownership_results: List[OwnershipResult]
    ) -> List[KnowledgeSiloGraph]:
        """Evaluate files for high single-developer reliance (silo) or inactive ownership (knowledge decay)."""
        decay_list = []
        if not git_history:
            for f in files:
                decay_list.append(KnowledgeSiloGraph(
                    file_path=f.path,
                    primary_owner="unknown@example.com",
                    silo_risk="LOW",
                    decay_score=0.0,
                    reasons=["No git history available to determine ownership decay"]
                ))
            return decay_list

        file_owners = {o.path: o.primary_author for o in ownership_results}

        owner_last_commit_idx = {}
        for idx, commit in enumerate(git_history):
            author = commit.author_email
            owner_last_commit_idx[author] = idx

        total_commits = len(git_history)

        for f in files:
            owner = file_owners.get(f.path, "unknown@example.com")
            reasons = []
            silo_risk = "LOW"
            decay_score = 0.0

            bus_factor = 1
            for o in ownership_results:
                if o.path == f.path:
                    bus_factor = o.bus_factor
                    break
            
            if bus_factor == 1:
                silo_risk = "HIGH"
                reasons.append("Knowledge Silo: file is owned exclusively by a single developer (Bus Factor=1)")

            if owner in owner_last_commit_idx:
                last_idx = owner_last_commit_idx[owner]
                inactive_commits = total_commits - 1 - last_idx
                if inactive_commits > 0:
                    decay_score = min(1.0, inactive_commits / 25.0)
                    
                if inactive_commits > 12:
                    silo_risk = "HIGH" if silo_risk == "HIGH" else "MEDIUM"
                    reasons.append(f"Knowledge Decay: primary owner ({owner}) has been inactive for the last {inactive_commits} commits")
            else:
                decay_score = 1.0
                silo_risk = "HIGH"
                reasons.append(f"Owner inactive: primary owner ({owner}) has no recent activity in the commit history")

            decay_list.append(KnowledgeSiloGraph(
                file_path=f.path,
                primary_owner=owner,
                silo_risk=silo_risk,
                decay_score=round(decay_score, 2),
                reasons=reasons if reasons else ["Co-owned with recent active contributions"]
            ))

        return decay_list

    def analyze(self, request: CodeAnalysisRequest) -> CodeAnalysisResult:
        """Run all code quality checks: Complexity, SAST, Duplication, Ownership, Hotspots, and advanced design/social metrics."""
        logger.info(f"Starting code quality scan for {len(request.files)} files...")

        # 1. Complexity & Code metrics
        complexity_results = []
        for f in request.files:
            if f.path.endswith(".py"):
                comp = self._calculate_python_complexity(f.content, f.path)
            else:
                comp = self._calculate_lexical_complexity(f.content, f.path)
            complexity_results.append(comp)

        # 2. Scanning duplication
        duplication_map = self._scan_duplicates(request.files)
        for comp in complexity_results:
            comp.duplicate_blocks = duplication_map.get(comp.path, [])

        # 3. Security issues
        security_issues = self._scan_security(request.files)

        # 4. Ownership metrics
        ownership_results = self._analyze_ownership(request.files, request.git_history)

        # 5. Hotspots detection
        hotspots = self._detect_hotspots(
            complexity_results=complexity_results,
            ownership_results=ownership_results,
            git_history=request.git_history,
            coverage_metadata=request.coverage_metadata
        )

        # Advanced Metrics Execution
        # 6. Code smells scan (LCOM4, CBO, God Class, Long Params, Nesting)
        code_smells = self._scan_code_smells(request.files)

        # 7. Circular dependencies detection
        dependency_cycles = self._detect_dependency_cycles(request.files)

        # 8. Semantic clones detection (TF-IDF + Cosine)
        semantic_clones = self._detect_semantic_clones(request.files)

        # 9. Taint analysis
        taint_issues = self._run_taint_analysis(request.files)

        # 10. JIT Commit risk assessments
        jit_commit_risks = self._analyze_jit_commit_risk(request.git_history)

        # 11. Knowledge decay and silo mapping
        knowledge_decay = self._analyze_knowledge_decay(request.files, request.git_history, ownership_results)

        logger.info(
            f"Scan complete: found {len(security_issues)} security issues, {len(hotspots)} hotspots, "
            f"{len(code_smells)} code smells, {len(dependency_cycles)} dependency cycles, "
            f"{len(semantic_clones)} semantic clones, {len(taint_issues)} taint issues."
        )

        return CodeAnalysisResult(
            complexity=complexity_results,
            security=security_issues,
            ownership=ownership_results,
            hotspots=hotspots,
            code_smells=code_smells,
            dependency_cycles=dependency_cycles,
            semantic_clones=semantic_clones,
            taint_issues=taint_issues,
            jit_commit_risks=jit_commit_risks,
            knowledge_decay=knowledge_decay
        )


# Shared instance of the analyzer
code_analyzer = CodeQualityAnalyzer()

