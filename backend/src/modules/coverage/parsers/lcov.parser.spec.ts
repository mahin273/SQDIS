import { LcovParser } from './lcov.parser';

describe('LcovParser', () => {
  let parser: LcovParser;

  beforeEach(() => {
    parser = new LcovParser();
  });

  it('parses module and overall coverage totals from LCOV records', () => {
    const content = [
      'TN:',
      'SF:./src/app.service.ts',
      'DA:1,1',
      'DA:2,0',
      'LF:2',
      'LH:1',
      'end_of_record',
      'TN:',
      'SF:/src/modules/auth/auth.service.ts',
      'LF:4',
      'LH:3',
      'end_of_record',
    ].join('\n');

    expect(parser.parse(content)).toEqual({
      linesTotal: 6,
      linesCovered: 4,
      coveragePercentage: 66.67,
      modules: [
        {
          modulePath: 'src/app.service.ts',
          linesTotal: 2,
          linesCovered: 1,
          coveragePercentage: 50,
        },
        {
          modulePath: 'src/modules/auth/auth.service.ts',
          linesTotal: 4,
          linesCovered: 3,
          coveragePercentage: 75,
        },
      ],
    });
  });

  it('normalizes Windows file paths', () => {
    const content = ['SF:.\\src\\modules\\coverage\\coverage.service.ts', 'LF:10', 'LH:8', 'end_of_record'].join(
      '\n',
    );

    expect(parser.parse(content).modules[0]).toMatchObject({
      modulePath: 'src/modules/coverage/coverage.service.ts',
      coveragePercentage: 80,
    });
  });

  it('ignores incomplete records and returns zero totals for empty content', () => {
    const result = parser.parse(['SF:src/ignored.ts', 'LH:3', 'end_of_record'].join('\n'));

    expect(result).toEqual({
      linesTotal: 0,
      linesCovered: 0,
      coveragePercentage: 0,
      modules: [],
    });
  });
});
