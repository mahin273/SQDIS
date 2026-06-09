import { NycParser } from './nyc.parser';

describe('NycParser', () => {
  let parser: NycParser;

  beforeEach(() => {
    parser = new NycParser();
  });

  it('parses statement coverage and normalizes absolute paths', () => {
    const content = JSON.stringify({
      'C:\\repo\\src\\app.ts': {
        s: { 0: 1, 1: 0, 2: 3 },
      },
      '/workspace/project/src/service.ts': {
        s: { 0: 0, 1: 0 },
      },
    });

    expect(parser.parse(content)).toEqual({
      linesTotal: 5,
      linesCovered: 2,
      coveragePercentage: 40,
      modules: [
        {
          modulePath: 'src/app.ts',
          linesTotal: 3,
          linesCovered: 2,
          coveragePercentage: 66.67,
        },
        {
          modulePath: 'src/service.ts',
          linesTotal: 2,
          linesCovered: 0,
          coveragePercentage: 0,
        },
      ],
    });
  });

  it('skips entries without statement data after validating at least one file is usable', () => {
    const content = JSON.stringify({
      'src/ignored.ts': {},
      'src/used.ts': { s: { 0: 1 } },
    });

    expect(parser.parse(content).modules).toEqual([
      {
        modulePath: 'src/used.ts',
        linesTotal: 1,
        linesCovered: 1,
        coveragePercentage: 100,
      },
    ]);
  });

  it('rejects invalid NYC JSON structures', () => {
    expect(() => parser.parse('{')).toThrow('Invalid NYC JSON format');
    expect(() => parser.parse('[]')).toThrow(
      'Invalid NYC JSON format: expected object with file paths as keys',
    );
    expect(() => parser.parse('{}')).toThrow(
      'Invalid NYC JSON format: no file coverage data found',
    );
    expect(() => parser.parse(JSON.stringify({ 'src/app.ts': {} }))).toThrow(
      'Invalid NYC JSON format: no files with required coverage properties (s) found',
    );
  });
});
