import { Logger } from '@nestjs/common';
import { CoverageFormat } from '../constants';
import { CoverageParser, CoverageParseResult } from './types';
import { LcovParser } from './lcov.parser';
import { CoberturaParser } from './cobertura.parser';
import { NycParser } from './nyc.parser';
import { JaCoCoParser } from './jacoco.parser';

/**
 * Factory for creating coverage parsers based on format
 */
export class CoverageParserFactory {
  private static readonly logger = new Logger(CoverageParserFactory.name);

  private static readonly parsers: Record<CoverageFormat, CoverageParser> = {
    [CoverageFormat.LCOV]: new LcovParser(),
    [CoverageFormat.COBERTURA]: new CoberturaParser(),
    [CoverageFormat.NYC_JSON]: new NycParser(),
    [CoverageFormat.JACOCO]: new JaCoCoParser(),
  };

  /**
   * Get the appropriate parser for a coverage format
   * @param format - The coverage format
   * @returns The parser instance
   */
  static getParser(format: CoverageFormat): CoverageParser {
    const parser = this.parsers[format];
    if (!parser) {
      this.logger.warn(`No parser found for format ${format}, defaulting to LCOV`);
      return this.parsers[CoverageFormat.LCOV];
    }
    return parser;
  }

  /**
   * Parse coverage content using the appropriate parser
   * @param content - Raw coverage file content
   * @param format - The coverage format
   * @returns Parsed coverage result
   */
  static parse(content: string, format: CoverageFormat): CoverageParseResult {
    const parser = this.getParser(format);
    return parser.parse(content);
  }
}
