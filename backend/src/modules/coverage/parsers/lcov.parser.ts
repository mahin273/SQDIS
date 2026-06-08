import { Logger } from '@nestjs/common';
import { CoverageParseResult, ModuleCoverage, CoverageParser } from './types';

/**
 * Parser for LCOV coverage format
 * LCOV format uses records like:
 * TN: (test name)
 * SF: (source file path)
 * DA: line_number,execution_count
 * LF: (lines found - total lines)
 * LH: (lines hit - covered lines)
 * end_of_record
 *
 */
export class LcovParser implements CoverageParser {
  private readonly logger = new Logger(LcovParser.name);

  /**
   * Parse LCOV format coverage data
   * Validates: Requirements 1.4.4
   */
  parse(content: string): CoverageParseResult {
    const modules: ModuleCoverage[] = [];
    let totalLinesFound = 0;
    let totalLinesHit = 0;

    // Split content into records (each file's coverage data)
    const records = content.split('end_of_record').filter((r) => r.trim());

    for (const record of records) {
      const lines = record
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      let sourceFile: string | null = null;
      let linesFound = 0;
      let linesHit = 0;

      for (const line of lines) {
        // Source file path
        if (line.startsWith('SF:')) {
          sourceFile = line.substring(3).trim();
        }
        // Lines found (total instrumented lines)
        else if (line.startsWith('LF:')) {
          linesFound = parseInt(line.substring(3).trim(), 10) || 0;
        }
        // Lines hit (covered lines)
        else if (line.startsWith('LH:')) {
          linesHit = parseInt(line.substring(3).trim(), 10) || 0;
        }
        // DA: line_number,execution_count - can be used for detailed line coverage
        // We use LF/LH for summary, but could parse DA for line-level detail
      }

      if (sourceFile && linesFound > 0) {
        const coveragePercentage = (linesHit / linesFound) * 100;

        modules.push({
          modulePath: this.normalizePath(sourceFile),
          linesTotal: linesFound,
          linesCovered: linesHit,
          coveragePercentage: Math.round(coveragePercentage * 100) / 100,
        });

        totalLinesFound += linesFound;
        totalLinesHit += linesHit;
      }
    }

    const overallPercentage = totalLinesFound > 0 ? (totalLinesHit / totalLinesFound) * 100 : 0;

    this.logger.debug(
      `Parsed LCOV: ${modules.length} modules, ${totalLinesHit}/${totalLinesFound} lines covered`,
    );

    return {
      linesTotal: totalLinesFound,
      linesCovered: totalLinesHit,
      coveragePercentage: Math.round(overallPercentage * 100) / 100,
      modules,
    };
  }

  /**
   * Normalize file path for consistent storage
   */
  private normalizePath(filePath: string): string {
    // Convert backslashes to forward slashes
    let normalized = filePath.replace(/\\/g, '/');
    // Remove leading ./ or /
    normalized = normalized.replace(/^\.?\//, '');
    return normalized;
  }
}
