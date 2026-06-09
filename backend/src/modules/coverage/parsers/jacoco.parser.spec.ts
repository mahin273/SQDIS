import { JaCoCoParser } from './jacoco.parser';

describe('JaCoCoParser', () => {
  let parser: JaCoCoParser;

  beforeEach(() => {
    parser = new JaCoCoParser();
  });

  it('parses class line counters and builds source paths', () => {
    const content = [
      '<report name="api">',
      '<package name="com/example">',
      '<class name="com/example/UserService" sourcefilename="UserService.java">',
      '<counter type="LINE" missed="2" covered="8"/>',
      '</class>',
      '<class name="Root" sourcefilename="Root.java">',
      '<counter type="LINE" missed="0" covered="5"/>',
      '</class>',
      '</package>',
      '</report>',
    ].join('');

    expect(parser.parse(content)).toEqual({
      linesTotal: 15,
      linesCovered: 13,
      coveragePercentage: 86.67,
      modules: [
        {
          modulePath: 'com/example/UserService.java',
          linesTotal: 10,
          linesCovered: 8,
          coveragePercentage: 80,
        },
        {
          modulePath: 'Root.java',
          linesTotal: 5,
          linesCovered: 5,
          coveragePercentage: 100,
        },
      ],
    });
  });

  it('skips classes without valid line counters', () => {
    const content = [
      '<report name="api">',
      '<class name="NoLine" sourcefilename="NoLine.java"><counter type="METHOD" missed="1" covered="1"/></class>',
      '<class name="Zero" sourcefilename="Zero.java"><counter type="LINE" missed="0" covered="0"/></class>',
      '</report>',
    ].join('');

    expect(parser.parse(content)).toEqual({
      linesTotal: 0,
      linesCovered: 0,
      coveragePercentage: 0,
      modules: [],
    });
  });

  it('rejects non-JaCoCo XML content', () => {
    expect(() => parser.parse('<coverage></coverage>')).toThrow(
      'Invalid JaCoCo format: missing <report> root element',
    );
    expect(() => parser.parse('<report></report>')).toThrow(
      'Invalid JaCoCo format: no <class> elements found',
    );
  });
});
