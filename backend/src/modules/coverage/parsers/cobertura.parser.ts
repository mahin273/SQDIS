import { Logger } from '@nestjs/common';
import { CoverageParseResult, ModuleCoverage, CoverageParser } from './types';

/**
 * Parser for Cobertura XML coverage format
 * Cobertura XML structure:
 * <coverage line-rate="0.85" lines-covered="850" lines-valid="1000">
 *   <packages>
 *     <package name="com.example">
 *       <classes>
 *         <class filename="src/Example.java" line-rate="0.9">
 *           <lines>
 *             <line number="1" hits="1"/>
 *           </lines>
 *         </class>
 *       </classes>
 *     </package>
 *   </packages>
 * </coverage>
 *
 */
export class CoberturaParser implements CoverageParser {
  private readonly logger = new Logger(CoberturaParser.name);

  /**
   * Parse Cobertura XML format coverage data
   */
  parse(content: string): CoverageParseResult {
    // Validate root <coverage> element exists
    if (!content.includes('<coverage')) {
      throw new Error('Invalid Cobertura format: missing <coverage> root element');
    }

    // Validate required attributes are present
    const hasLinesCovered = content.includes('lines-covered=');
    const hasLinesValid = content.includes('lines-valid=');
    const hasLineRate = content.includes('line-rate=');

    if (!hasLinesCovered && !hasLinesValid && !hasLineRate) {
      throw new Error(
        'Invalid Cobertura format: missing required coverage attributes (lines-covered, lines-valid, or line-rate)',
      );
    }

    const modules: ModuleCoverage[] = [];
    let totalLinesValid = 0;
    let totalLinesCovered = 0;

    // Parse coverage element attributes for overall stats
    const coverageMatch = content.match(
      /<coverage[^>]*\s+lines-covered="(\d+)"[^>]*\s+lines-valid="(\d+)"/i,
    );
    const coverageMatchAlt = content.match(
      /<coverage[^>]*\s+lines-valid="(\d+)"[^>]*\s+lines-covered="(\d+)"/i,
    );

    if (coverageMatch) {
      totalLinesCovered = parseInt(coverageMatch[1], 10) || 0;
      totalLinesValid = parseInt(coverageMatch[2], 10) || 0;
    } else if (coverageMatchAlt) {
      totalLinesValid = parseInt(coverageMatchAlt[1], 10) || 0;
      totalLinesCovered = parseInt(coverageMatchAlt[2], 10) || 0;
    }

    // Parse individual class/file coverage
    // Match class elements with filename and line-rate
    const classRegex = /<class[^>]*\s+filename="([^"]+)"[^>]*>/gi;
    const lineRateRegex = /line-rate="([^"]+)"/i;

    // Also need to extract lines for each class to get accurate counts
    const classBlocks = this.extractClassBlocks(content);

    for (const block of classBlocks) {
      const filenameMatch = block.match(/filename="([^"]+)"/i);
      const lineRateMatch = block.match(lineRateRegex);

      if (filenameMatch) {
        const filename = filenameMatch[1];
        const lineRate = lineRateMatch ? parseFloat(lineRateMatch[1]) : 0;

        // Count lines in this class
        const { linesTotal, linesCovered } = this.countLines(block);

        if (linesTotal > 0) {
          const coveragePercentage = (linesCovered / linesTotal) * 100;

          modules.push({
            modulePath: this.normalizePath(filename),
            linesTotal,
            linesCovered,
            coveragePercentage: Math.round(coveragePercentage * 100) / 100,
          });
        } else if (lineRate > 0) {
          // Fallback: use line-rate if no line details available
          // Estimate lines based on overall ratio
          modules.push({
            modulePath: this.normalizePath(filename),
            linesTotal: 0,
            linesCovered: 0,
            coveragePercentage: Math.round(lineRate * 100 * 100) / 100,
          });
        }
      }
    }

    // If we couldn't get totals from attributes, sum from modules
    if (totalLinesValid === 0 && modules.length > 0) {
      totalLinesValid = modules.reduce((sum, m) => sum + m.linesTotal, 0);
      totalLinesCovered = modules.reduce((sum, m) => sum + m.linesCovered, 0);
    }

    const overallPercentage = totalLinesValid > 0 ? (totalLinesCovered / totalLinesValid) * 100 : 0;

    this.logger.debug(
      `Parsed Cobertura: ${modules.length} modules, ${totalLinesCovered}/${totalLinesValid} lines covered`,
    );

    return {
      linesTotal: totalLinesValid,
      linesCovered: totalLinesCovered,
      coveragePercentage: Math.round(overallPercentage * 100) / 100,
      modules,
    };
  }

  /**
   * Extract class blocks from XML content
   */
  private extractClassBlocks(content: string): string[] {
    const blocks: string[] = [];
    const classStartRegex = /<class\s/gi;
    let match;

    while ((match = classStartRegex.exec(content)) !== null) {
      const startIndex = match.index;
      // Find the closing </class> tag
      const endMatch = content.indexOf('</class>', startIndex);
      if (endMatch !== -1) {
        blocks.push(content.substring(startIndex, endMatch + 8));
      }
    }

    return blocks;
  }

  /**
   * Count lines in a class block
   */
  private countLines(classBlock: string): { linesTotal: number; linesCovered: number } {
    let linesTotal = 0;
    let linesCovered = 0;

    // Match line elements: <line number="X" hits="Y"/>
    const lineRegex = /<line[^>]*\s+hits="(\d+)"[^>]*\/?>/gi;
    let lineMatch;

    while ((lineMatch = lineRegex.exec(classBlock)) !== null) {
      linesTotal++;
      const hits = parseInt(lineMatch[1], 10);
      if (hits > 0) {
        linesCovered++;
      }
    }

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
    return normalized;
  }
}
