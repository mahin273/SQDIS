import { CoverageFormat } from '../constants';
import { CoberturaParser } from './cobertura.parser';
import { CoverageParserFactory } from './parser.factory';

describe('CoverageParserFactory', () => {
  it.each([
    CoverageFormat.LCOV,
    CoverageFormat.COBERTURA,
    CoverageFormat.NYC_JSON,
    CoverageFormat.JACOCO,
  ])('returns a parser for %s', (format) => {
    expect(CoverageParserFactory.getParser(format)).toHaveProperty('parse');
  });

  it('delegates parsing to the selected parser', () => {
    const result = CoverageParserFactory.parse(
      '<coverage lines-covered="1" lines-valid="1"><class filename="src/app.ts"><lines><line number="1" hits="1"/></lines></class></coverage>',
      CoverageFormat.COBERTURA,
    );

    expect(result.coveragePercentage).toBe(100);
    expect(CoverageParserFactory.getParser(CoverageFormat.COBERTURA)).toBeInstanceOf(
      CoberturaParser,
    );
  });

  it('falls back to LCOV when an unknown format is requested', () => {
    const parser = CoverageParserFactory.getParser('unknown' as CoverageFormat);

    expect(parser.parse('SF:src/app.ts\nLF:1\nLH:1\nend_of_record').coveragePercentage).toBe(100);
  });
});
