import { Logger } from '@nestjs/common';
import { CoverageParseResult, ModuleCoverage, CoverageParser } from './types';

/**
 * Parser for JaCoCo XML coverage format
 * JaCoCo XML structure:
 * <report name="Project">
 *   <package name="com/example/package">
 *     <class name="com/example/package/ClassName" sourcefilename="ClassName.java">
 *       <counter type="INSTRUCTION" missed="10" covered="90"/>
 *       <counter type="BRANCH" missed="2" covered="8"/>
 *       <counter type="LINE" missed="5" covered="45"/>
 *       <counter type="METHOD" missed="1" covered="9"/>
 *     </class>
 *   </package>
 * </report>
 *
 */
export class JaCoCoParser implements CoverageParser {
  private readonly logger = new Logger(JaCoCoParser.name);

  /**
   * Parse JaCoCo XML format coverage data
   */
  parse(content: string): CoverageParseResult {
    // Validate root <report> element exists
    if (!content.includes('<report')) {
      throw new Error('Invalid JaCoCo format: missing <report> root element');
    }

    // Validate has classes
    if (!content.includes('<class')) {
      throw new Error('Invalid JaCoCo format: no <class> elements found');
    }

    const modules: ModuleCoverage[] = [];
    let totalLinesMissed = 0;
    let totalLinesCovered = 0;

    // Extract all class blocks
    const classBlocks = this.extractClassBlocks(content);

    for (const block of classBlocks) {
      const classData = this.parseClassBlock(block);

      if (classData) {
        modules.push(classData);
        totalLinesMissed += classData.linesTotal - classData.linesCovered;
        totalLinesCovered += classData.linesCovered;
      }
    }

    const totalLines = totalLinesMissed + totalLinesCovered;
    const overallPercentage = totalLines > 0 ? (totalLinesCovered / totalLines) * 100 : 0;

    this.logger.debug(
      `Parsed JaCoCo: ${modules.length} modules, ${totalLinesCovered}/${totalLines} lines covered`,
    );

    return {
      linesTotal: totalLines,
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
   * Parse a single class block to extract coverage data
   */
  private parseClassBlock(block: string): ModuleCoverage | null {
    // Extract class name or sourcefilename
    const sourceFilenameMatch = block.match(/sourcefilename="([^"]+)"/i);
    const classNameMatch = block.match(/<class[^>]*\s+name="([^"]+)"/i);

    let modulePath: string;

    if (sourceFilenameMatch) {
      // Use sourcefilename if available
      const sourceFilename = sourceFilenameMatch[1];
      // Extract package from class name attribute
      const packageMatch = block.match(/name="([^"]+)"/i);
      if (packageMatch) {
        const fullClassName = packageMatch[1];
        const lastSlash = fullClassName.lastIndexOf('/');
        if (lastSlash > 0) {
          const packagePath = fullClassName.substring(0, lastSlash);
          modulePath = `${packagePath}/${sourceFilename}`;
        } else {
          modulePath = sourceFilename;
        }
      } else {
        modulePath = sourceFilename;
      }
    } else if (classNameMatch) {
      // Fallback to class name
      modulePath = classNameMatch[1] + '.java';
    } else {
      // No identifiable path
      return null;
    }

    // Extract LINE counter
    const lineCounterTagMatch = block.match(/<counter\s+[^>]*type="LINE"[^>]*\/?>/i);

    if (!lineCounterTagMatch) {
      // No LINE counter found, skip this class
      return null;
    }

    const tagContent = lineCounterTagMatch[0];
    const missedMatch = tagContent.match(/missed="(\d+)"/i);
    const coveredMatch = tagContent.match(/covered="(\d+)"/i);

    if (!missedMatch || !coveredMatch) {
      return null;
    }

    const linesMissed = parseInt(missedMatch[1], 10) || 0;
    const linesCovered = parseInt(coveredMatch[1], 10) || 0;
    const linesTotal = linesMissed + linesCovered;

    if (linesTotal === 0) {
      return null;
    }

    const coveragePercentage = (linesCovered / linesTotal) * 100;

    return {
      modulePath: this.normalizePath(modulePath),
      linesTotal,
      linesCovered,
      coveragePercentage: Math.round(coveragePercentage * 100) / 100,
    };
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
