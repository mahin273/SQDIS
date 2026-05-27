import { Logger } from '@nestjs/common';
import { CoverageParseResult, ModuleCoverage, CoverageParser } from './types';

/**
 * NYC (Istanbul) JSON coverage format structure:
 * {
 *   "/path/to/file.js": {
 *     "path": "/path/to/file.js",
 *     "statementMap": { "0": { start: {...}, end: {...} }, ... },
 *     "s": { "0": 1, "1": 0, ... },  // statement execution counts
 *     "fnMap": { ... },
 *     "f": { ... },  // function execution counts
 *     "branchMap": { ... },
 *     "b": { ... }   // branch execution counts
 *   }
 * }
 *
 */

interface NycFileCoverage {
  path?: string;
  statementMap?: Record<string, { start: { line: number }; end: { line: number } }>;
  s?: Record<string, number>; // statement execution counts
  fnMap?: Record<string, any>;
  f?: Record<string, number>; // function execution counts
  branchMap?: Record<string, any>;
  b?: Record<string, number[]>; // branch execution counts
}

export class NycParser implements CoverageParser {
  private readonly logger = new Logger(NycParser.name);

  /**
   * Parse NYC JSON format coverage data
   */
  parse(content: string): CoverageParseResult {
    const modules: ModuleCoverage[] = [];
    let totalStatements = 0;
    let totalCoveredStatements = 0;

    let data: Record<string, NycFileCoverage>;

    // Validate JSON structure (Requirement 3.1)
    try {
      data = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid NYC JSON format: ${error.message}`);
    }

    // Validate that data is an object and not an array or null (Requirement 3.6)
    if (typeof data !== 'object' || Array.isArray(data) || data === null) {
      throw new Error('Invalid NYC JSON format: expected object with file paths as keys');
    }

    // Validate that at least one file entry exists (Requirement 3.7)
    const fileEntries = Object.entries(data);
    if (fileEntries.length === 0) {
      throw new Error('Invalid NYC JSON format: no file coverage data found');
    }

    // Validate that at least one file has required coverage properties (Requirement 3.7)
    let hasValidFile = false;
    for (const [, fileCoverage] of fileEntries) {
      if (fileCoverage && typeof fileCoverage === 'object' && fileCoverage.s) {
        hasValidFile = true;
        break;
      }
    }

    if (!hasValidFile) {
      throw new Error(
        'Invalid NYC JSON format: no files with required coverage properties (s) found',
      );
    }

    // NYC JSON has file paths as keys
    for (const [filePath, fileCoverage] of fileEntries) {
      // Skip non-object entries
      if (!fileCoverage || typeof fileCoverage !== 'object') {
        continue;
      }

      const { linesTotal, linesCovered } = this.calculateLineCoverage(fileCoverage);

      if (linesTotal > 0) {
        const coveragePercentage = (linesCovered / linesTotal) * 100;

        modules.push({
          modulePath: this.normalizePath(filePath),
          linesTotal,
          linesCovered,
          coveragePercentage: Math.round(coveragePercentage * 100) / 100,
        });

        totalStatements += linesTotal;
        totalCoveredStatements += linesCovered;
      }
    }

    const overallPercentage =
      totalStatements > 0 ? (totalCoveredStatements / totalStatements) * 100 : 0;

    this.logger.debug(
      `Parsed NYC JSON: ${modules.length} modules, ${totalCoveredStatements}/${totalStatements} statements covered`,
    );

    return {
      linesTotal: totalStatements,
      linesCovered: totalCoveredStatements,
      coveragePercentage: Math.round(overallPercentage * 100) / 100,
      modules,
    };
  }

  /**
   * Calculate line coverage from NYC file coverage data
   * Uses statement coverage as the primary metric
   */
  private calculateLineCoverage(fileCoverage: NycFileCoverage): {
    linesTotal: number;
    linesCovered: number;
  } {
    // Use statement coverage (s) as the primary metric
    const statements = fileCoverage.s;

    if (!statements || typeof statements !== 'object') {
      return { linesTotal: 0, linesCovered: 0 };
    }

    const statementIds = Object.keys(statements);
    const linesTotal = statementIds.length;
    const linesCovered = statementIds.filter((id) => statements[id] > 0).length;

    return { linesTotal, linesCovered };
  }

  /**
   * Normalize file path for consistent storage
   */
  private normalizePath(filePath: string): string {
    // Remove leading ./ or /
    let normalized = filePath.replace(/^\.?\//, '');
    // Convert backslashes to forward slashes
    normalized = normalized.replace(/\\/g, '/');
    // Remove absolute path prefixes (common in NYC output)
    // e.g., /Users/dev/project/src/file.js -> src/file.js
    const srcIndex = normalized.indexOf('src/');
    if (srcIndex > 0) {
      normalized = normalized.substring(srcIndex);
    }
    return normalized;
  }
}
