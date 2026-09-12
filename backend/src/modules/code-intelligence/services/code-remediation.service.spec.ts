import { Test, TestingModule } from '@nestjs/testing';
import { CodeRemediationService } from './code-remediation.service';

describe('CodeRemediationService', () => {
  let service: CodeRemediationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CodeRemediationService],
    }).compile();

    service = module.get<CodeRemediationService>(CodeRemediationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should detect deep nesting and prescribe Guard Clause Inversion', () => {
    const nestedCode = `
function processOrder(order) {
  if (order) {
    if (order.isValid) {
      if (order.hasStock) {
        if (!order.isProcessed) {
          order.dispatch();
        }
      }
    }
  }
}
`;

    const result = service.generateAdvice({
      code: nestedCode,
      language: 'typescript',
    });

    expect(result.totalSmellsFound).toBeGreaterThanOrEqual(1);
    const recipe = result.recipes.find((r) => r.smellType === 'DEEP_NESTING');
    expect(recipe).toBeDefined();
    expect(recipe?.recommendedStrategy).toBe('Guard Clause Inversion');
    expect(recipe?.estimatedComplexityReductionPct).toBe(45);
    expect(recipe?.beforeSnippet).toContain('processOrder');
    expect(recipe?.afterSnippet).toContain('return');
    expect(result.refactoringPotentialScore).toBeLessThan(100);
  });

  it('should detect long procedural methods and prescribe Method Decomposition', () => {
    // Generate code with > 35 lines and multiple branches
    const lines = [
      'function handleRequest(req) {',
      ...Array.from({ length: 40 }, (_, i) => `  if (req.prop${i}) { doSomething(${i}); }`),
      '}',
    ];
    const longCode = lines.join('\n');

    const result = service.generateAdvice({
      code: longCode,
      language: 'javascript',
    });

    const recipe = result.recipes.find((r) => r.smellType === 'LONG_METHOD');
    expect(recipe).toBeDefined();
    expect(recipe?.recommendedStrategy).toBe('Method Decomposition (Extract Sub-Routine)');
    expect(recipe?.stepByStep.length).toBeGreaterThanOrEqual(3);
  });

  it('should detect parameter bloat when signature has >= 5 arguments', () => {
    const bloatedCode = `function sendNotification(user, channel, template, priority, retryCount, fallbackEmail) {
  return true;
}`;

    const result = service.generateAdvice({
      code: bloatedCode,
      language: 'typescript',
    });

    const recipe = result.recipes.find((r) => r.smellType === 'PARAMETER_BLOAT');
    expect(recipe).toBeDefined();
    expect(recipe?.recommendedStrategy).toBe('Introduce Parameter / Configuration Object');
    expect(recipe?.afterSnippet).toContain('interface');
  });

  it('should detect chained ternaries and recommend lookup table', () => {
    const ternaryCode = `const label = type === 1 ? 'one' : type === 2 ? 'two' : type === 3 ? 'three' : 'unknown';`;

    const result = service.generateAdvice({
      code: ternaryCode,
      language: 'typescript',
    });

    const recipe = result.recipes.find((r) => r.smellType === 'CHAINED_TERNARY');
    expect(recipe).toBeDefined();
    expect(recipe?.recommendedStrategy).toBe('Replace Conditional with Lookup Map');
  });

  it('should detect high cyclomatic complexity and prescribe strategy pattern', () => {
    const cleanSmallCode = 'function calc() { return 42; }';

    const result = service.generateAdvice({
      code: cleanSmallCode,
      cyclomaticComplexity: 16,
    });

    const recipe = result.recipes.find((r) => r.smellType === 'EXCESSIVE_BRANCHING');
    expect(recipe).toBeDefined();
    expect(recipe?.severity).toBe('CRITICAL');
    expect(recipe?.recommendedStrategy).toBe('Strategy Pattern & Command Dispatch');
  });

  it('should return score 100 and zero smells for clean, well-structured code', () => {
    const cleanCode = `
function calculateTotal(subtotal: number, taxRate: number): number {
  if (subtotal <= 0) return 0;
  return subtotal * (1 + taxRate);
}
`;

    const result = service.generateAdvice({
      code: cleanCode,
      language: 'typescript',
    });

    expect(result.totalSmellsFound).toBe(0);
    expect(result.refactoringPotentialScore).toBe(100);
    expect(result.recipes).toHaveLength(0);
  });
});
