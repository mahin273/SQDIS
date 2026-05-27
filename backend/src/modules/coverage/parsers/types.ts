/**
 * Coverage parser types
 */

/**
 * Coverage data for a single module/file
 */
export interface ModuleCoverage {
  /** Path to the module/file */
  modulePath: string;
  /** Total number of lines (or statements) in the module */
  linesTotal: number;
  /** Number of covered lines (or statements) */
  linesCovered: number;
  /** Coverage percentage (0-100) */
  coveragePercentage: number;
}

/**
 * Result of parsing a coverage report
 * Validates: Requirements 1.4.4, 1.4.5
 */
export interface CoverageParseResult {
  /** Total lines across all modules */
  linesTotal: number;
  /** Total covered lines across all modules */
  linesCovered: number;
  /** Overall coverage percentage (0-100) */
  coveragePercentage: number;
  /** Per-module coverage data */
  modules: ModuleCoverage[];
}

/**
 * Interface for coverage parsers
 * Validates: Requirements 1.4.4
 */
export interface CoverageParser {
  /**
   * Parse coverage report content
   * @param content - Raw content of the coverage file
   * @returns Parsed coverage data
   */
  parse(content: string): CoverageParseResult;
}
