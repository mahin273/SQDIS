import { CoberturaParser } from './cobertura.parser';

describe('CoberturaParser', () => {
  let parser: CoberturaParser;

  beforeEach(() => {
    parser = new CoberturaParser();
  });

  it('parses root totals and per-class line coverage', () => {
    const content = [
      '<coverage lines-covered="3" lines-valid="5" line-rate="0.6">',
      '<packages><package name="api"><classes>',
      '<class filename="./src/app.ts" line-rate="0.5">',
      '<lines><line number="1" hits="1"/><line number="2" hits="0"/></lines>',
      '</class>',
      '<class filename="src/service.ts" line-rate="0.6667">',
      '<lines><line number="1" hits="1"/><line number="2" hits="1"/><line number="3" hits="0"/></lines>',
      '</class>',
      '</classes></package></packages>',
      '</coverage>',
    ].join('');

    expect(parser.parse(content)).toEqual({
      linesTotal: 5,
      linesCovered: 3,
      coveragePercentage: 60,
      modules: [
        {
          modulePath: 'src/app.ts',
          linesTotal: 2,
          linesCovered: 1,
          coveragePercentage: 50,
        },
        {
          modulePath: 'src/service.ts',
          linesTotal: 3,
          linesCovered: 2,
          coveragePercentage: 66.67,
        },
      ],
    });
  });

  it('falls back to summing module totals when root totals are absent', () => {
    const content = [
      '<coverage line-rate="0.5">',
      '<class filename="src/a.ts"><lines><line number="1" hits="1"/></lines></class>',
      '<class filename="src/b.ts"><lines><line number="1" hits="0"/></lines></class>',
      '</coverage>',
    ].join('');

    expect(parser.parse(content)).toMatchObject({
      linesTotal: 2,
      linesCovered: 1,
      coveragePercentage: 50,
    });
  });

  it('rejects content without a Cobertura root element', () => {
    expect(() => parser.parse('<report></report>')).toThrow(
      'Invalid Cobertura format: missing <coverage> root element',
    );
  });
});
