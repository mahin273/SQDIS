import { Injectable, Logger } from '@nestjs/common';
import {
  RemediationRequestDto,
  RemediationRecipeDto,
  RemediationResponseDto,
} from '../dto/remediation.dto';

/**
 * Automated Code Remediation & Refactoring Advisor Engine.
 * Analyzes code structure, diagnoses structural code smells,
 * and generates prescriptive refactoring blueprints with before/after transformations.
 */
@Injectable()
export class CodeRemediationService {
  private readonly logger = new Logger(CodeRemediationService.name);

  /**
   * Diagnose code smells and generate prescriptive refactoring advice
   */
  generateAdvice(dto: RemediationRequestDto): RemediationResponseDto {
    const rawCode = dto.code || '';
    const language = (dto.language || 'typescript').toLowerCase();
    const lines = rawCode.split('\n');
    const recipes: RemediationRecipeDto[] = [];

    // 1. Analyze Deep Nesting
    const nestingResult = this.analyzeNesting(lines, language);
    if (nestingResult.maxDepth >= 4) {
      recipes.push(this.buildGuardClauseRecipe(nestingResult.maxDepth, language));
    }

    // 2. Analyze Method Length & Density
    const loc = lines.filter((l) => l.trim().length > 0).length;
    const branchCount = this.countBranchingTokens(rawCode);
    if (loc > 35 || (loc > 20 && branchCount >= 6)) {
      recipes.push(this.buildMethodDecompositionRecipe(loc, branchCount, language));
    }

    // 3. Analyze Parameter Arity
    const paramCount = this.detectMaxParameterCount(rawCode);
    if (paramCount >= 5) {
      recipes.push(this.buildParameterObjectRecipe(paramCount, language));
    }

    // 4. Analyze Chained Ternary Operators
    if (this.detectChainedTernaries(rawCode)) {
      recipes.push(this.buildLookupTableRecipe(language));
    }

    // 5. Analyze Excessive Cyclomatic Branching
    const reportedComplexity = dto.cyclomaticComplexity || branchCount;
    if (reportedComplexity >= 10 && !recipes.some((r) => r.smellType === 'EXCESSIVE_BRANCHING')) {
      recipes.push(this.buildStrategyPatternRecipe(reportedComplexity, language));
    }

    // Calculate Refactoring Potential Score (100 = completely clean)
    let score = 100;
    for (const recipe of recipes) {
      if (recipe.severity === 'CRITICAL') score -= 25;
      else if (recipe.severity === 'WARNING') score -= 15;
      else score -= 5;
    }
    score = Math.max(10, Math.min(100, score));

    return {
      targetFilePath: dto.filePath,
      totalSmellsFound: recipes.length,
      refactoringPotentialScore: score,
      recipes,
    };
  }

  /**
   * Measure maximum indentation / brace nesting depth
   */
  private analyzeNesting(lines: string[], language: string): { maxDepth: number } {
    let maxDepth = 0;
    let currentBraceDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

      if (language === 'python') {
        // Measure leading whitespace indentation
        const leadingSpaces = line.search(/\S/);
        if (leadingSpaces > 0) {
          const depth = Math.floor(leadingSpaces / 4);
          if (depth > maxDepth) maxDepth = depth;
        }
      } else {
        // Measure brace depth
        for (const char of line) {
          if (char === '{') currentBraceDepth++;
          else if (char === '}') currentBraceDepth = Math.max(0, currentBraceDepth - 1);
          if (currentBraceDepth > maxDepth) maxDepth = currentBraceDepth;
        }
      }
    }

    return { maxDepth };
  }

  /**
   * Count branching keywords and boolean operators
   */
  private countBranchingTokens(code: string): number {
    const branchRegex = /\b(if|else\s+if|switch|case|catch|for|while|return\s+[^;]+(?:\?|&&|\|\|))\b|&&|\|\||\?/g;
    const matches = code.match(branchRegex);
    return matches ? matches.length : 0;
  }

  /**
   * Detect maximum parameter count in function declarations
   */
  private detectMaxParameterCount(code: string): number {
    const functionSignatureRegex = /(?:function\s+[\w$]*|\b[\w$]+\s*=\s*(?:async\s*)?\([^)]*\)|(?:async\s*)?\([^)]*\)\s*=>)\s*\(([^)]*)\)/g;
    let maxParams = 0;
    let match: RegExpExecArray | null;

    while ((match = functionSignatureRegex.exec(code)) !== null) {
      if (match[1]) {
        const params = match[1].split(',').map((p) => p.trim()).filter(Boolean);
        if (params.length > maxParams) {
          maxParams = params.length;
        }
      }
    }

    return maxParams;
  }

  /**
   * Detect chained ternary expressions on single or consecutive lines
   */
  private detectChainedTernaries(code: string): boolean {
    const lines = code.split('\n');
    for (const line of lines) {
      const questionMarks = (line.match(/\?/g) || []).length;
      const colons = (line.match(/:/g) || []).length;
      if (questionMarks >= 2 && colons >= 2) {
        return true;
      }
    }
    return /\?[^:]+\?[^:]+:/g.test(code);
  }

  /**
   * Build Guard Clause Inversion Recipe
   */
  private buildGuardClauseRecipe(depth: number, language: string): RemediationRecipeDto {
    const isPython = language === 'python';
    return {
      smellType: 'DEEP_NESTING',
      title: 'Deeply Nested Conditionals (Arrow Anti-Pattern)',
      severity: depth >= 5 ? 'CRITICAL' : 'WARNING',
      recommendedStrategy: 'Guard Clause Inversion',
      estimatedComplexityReductionPct: 45,
      explanation: `Observed nesting depth of ${depth} creates high cognitive strain and fragile maintenance boundaries. Inverting conditionals to return early flattens the execution flow.`,
      stepByStep: [
        'Identify precondition checks guarding the core routine',
        'Invert the conditional expression (e.g. `if (valid)` becomes `if (!valid) return`)',
        'Exit immediately with a return or throw statement',
        'Un-indent the remaining happy path to the root function level',
      ],
      beforeSnippet: isPython
        ? `def process_order(order):\n    if order is not None:\n        if order.is_valid:\n            if order.has_stock:\n                order.dispatch()`
        : `function processOrder(order) {\n  if (order) {\n    if (order.isValid) {\n      if (order.hasStock) {\n        order.dispatch();\n      }\n    }\n  }\n}`,
      afterSnippet: isPython
        ? `def process_order(order):\n    if not order or not order.is_valid:\n        return\n    if not order.has_stock:\n        return\n\n    order.dispatch()`
        : `function processOrder(order) {\n  if (!order || !order.isValid) return;\n  if (!order.hasStock) return;\n\n  order.dispatch();\n}`,
    };
  }

  /**
   * Build Method Decomposition Recipe
   */
  private buildMethodDecompositionRecipe(loc: number, branches: number, language: string): RemediationRecipeDto {
    const isPython = language === 'python';
    return {
      smellType: 'LONG_METHOD',
      title: 'Monolithic Routine (Exceeding Single Responsibility)',
      severity: 'WARNING',
      recommendedStrategy: 'Method Decomposition (Extract Sub-Routine)',
      estimatedComplexityReductionPct: 40,
      explanation: `Routine spans ${loc} lines with ${branches} branch conditions. Extracting cohesive sub-tasks into discrete helper functions improves unit testability and maintainability.`,
      stepByStep: [
        'Group sequential statements by responsibility (e.g. validation, data calculation, persistence)',
        'Extract each group into a focused pure helper function',
        'Pass only required state as explicit arguments',
        'Keep the parent orchestrator method under 15 lines of declarative calls',
      ],
      beforeSnippet: isPython
        ? `def execute_pipeline(data):\n    # 40+ lines doing validation, parsing, calculations and saving\n    ...`
        : `function executePipeline(data) {\n  // 40+ lines doing validation, transformations, calculations, and db writes\n  ...`,
      afterSnippet: isPython
        ? `def execute_pipeline(data):\n    validate_input(data)\n    result = transform_metrics(data)\n    save_record(result)\n    return result`
        : `function executePipeline(data) {\n  validateInput(data);\n  const result = transformMetrics(data);\n  saveRecord(result);\n  return result;\n}`,
    };
  }

  /**
   * Build Parameter Object Recipe
   */
  private buildParameterObjectRecipe(paramCount: number, language: string): RemediationRecipeDto {
    const isPython = language === 'python';
    return {
      smellType: 'PARAMETER_BLOAT',
      title: 'Excessive Parameter List (High Arity)',
      severity: 'WARNING',
      recommendedStrategy: 'Introduce Parameter / Configuration Object',
      estimatedComplexityReductionPct: 25,
      explanation: `Function signature requires ${paramCount} arguments. Large parameter lists cause positional call errors and make future schema modifications difficult.`,
      stepByStep: [
        'Declare an interface or typed options class bundling the arguments',
        'Replace positional function arguments with a single options object',
        'Use object destructuring in the function header',
        'Refactor callers to pass named options for self-documenting invocations',
      ],
      beforeSnippet: isPython
        ? `def create_user(name, email, role, dept, status, notify): ...`
        : `function createUser(name, email, role, dept, status, notify) { ... }`,
      afterSnippet: isPython
        ? `from dataclasses import dataclass\n\n@dataclass\nclass CreateUserOptions:\n    name: str\n    email: str\n    role: str\n    dept: str\n    status: str\n    notify: bool\n\ndef create_user(options: CreateUserOptions): ...`
        : `interface CreateUserOptions {\n  name: string;\n  email: string;\n  role: string;\n  dept: string;\n  status: string;\n  notify: boolean;\n}\n\nfunction createUser(options: CreateUserOptions) { ... }`,
    };
  }

  /**
   * Build Lookup Table Recipe
   */
  private buildLookupTableRecipe(language: string): RemediationRecipeDto {
    const isPython = language === 'python';
    return {
      smellType: 'CHAINED_TERNARY',
      title: 'Complex Chained Conditionals / Nested Ternaries',
      severity: 'WARNING',
      recommendedStrategy: 'Replace Conditional with Lookup Map',
      estimatedComplexityReductionPct: 35,
      explanation: 'Chained ternary expressions reduce readability and increase branching paths. Replacing them with a constant dictionary lookup yields O(1) constant-time access.',
      stepByStep: [
        'Identify the input keys and their corresponding outcome values',
        'Declare a constant lookup dictionary mapping keys to outcomes',
        'Replace nested conditionals with direct key indexing and safe fallback',
      ],
      beforeSnippet: isPython
        ? `status = "A" if code == 1 else "B" if code == 2 else "C" if code == 3 else "UNKNOWN"`
        : `const status = code === 1 ? 'A' : code === 2 ? 'B' : code === 3 ? 'C' : 'UNKNOWN';`,
      afterSnippet: isPython
        ? `STATUS_MAP = {1: "A", 2: "B", 3: "C"}\nstatus = STATUS_MAP.get(code, "UNKNOWN")`
        : `const STATUS_MAP: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };\nconst status = STATUS_MAP[code] ?? 'UNKNOWN';`,
    };
  }

  /**
   * Build Strategy Pattern Recipe
   */
  private buildStrategyPatternRecipe(complexity: number, language: string): RemediationRecipeDto {
    const isPython = language === 'python';
    return {
      smellType: 'EXCESSIVE_BRANCHING',
      title: 'High Cyclomatic Complexity (Branch Explosion)',
      severity: 'CRITICAL',
      recommendedStrategy: 'Strategy Pattern & Command Dispatch',
      estimatedComplexityReductionPct: 50,
      explanation: `Observed cyclomatic complexity of ${complexity} exceeds recommended safety limits (> 10). Dispatching operations via strategy handlers eliminates large switch/if blocks.`,
      stepByStep: [
        'Define a common interface or signature for each action variant',
        'Create isolated handler functions or classes for each case',
        'Register handlers in a dispatcher map keyed by operation type',
        'Execute the matched strategy dynamically to eliminate branching',
      ],
      beforeSnippet: isPython
        ? `if op == "add": do_add()\nelif op == "sub": do_sub()\nelif op == "mul": do_mul()\n# ... 10+ elif blocks`
        : `switch (operation) {\n  case 'ADD': return add();\n  case 'SUB': return sub();\n  // ... 10+ cases\n}`,
      afterSnippet: isPython
        ? `STRATEGIES = {\n    "add": do_add,\n    "sub": do_sub,\n    "mul": do_mul,\n}\nhandler = STRATEGIES.get(op, default_handler)\nhandler()`
        : `const STRATEGIES: Record<string, () => void> = {\n  ADD: add,\n  SUB: sub,\n  MUL: mul,\n};\nconst handler = STRATEGIES[operation] ?? defaultHandler;\nhandler();`,
    };
  }
}
