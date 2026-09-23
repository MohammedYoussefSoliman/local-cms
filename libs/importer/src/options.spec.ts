import { HelpRequested, parseArgs } from './options';

describe('parseArgs', () => {
  it('requires a source', () => {
    expect(() => parseArgs([])).toThrow('--source');
  });

  it('is a dry run unless told otherwise', () => {
    // The whole safety property of the CLI: the destructive mode is the one you
    // have to type.
    expect(parseArgs(['--source', '/tmp/src']).commit).toBe(false);
    expect(parseArgs(['--source', '/tmp/src', '--commit']).commit).toBe(true);
  });

  it('lets --dry-run override --commit', () => {
    expect(
      parseArgs(['--source', '/tmp/src', '--commit', '--dry-run']).commit,
    ).toBe(false);
  });

  it('accepts --flag=value as well as --flag value', () => {
    expect(parseArgs(['--source=/tmp/src', '--default-locale=ar'])).toMatchObject(
      { defaultLocaleCode: 'ar' },
    );
  });

  it('defaults to publishing, because the copy is already live', () => {
    expect(parseArgs(['--source', '/tmp/src']).status).toBe('published');
  });

  it('rejects a status the importer does not write', () => {
    expect(() =>
      parseArgs(['--source', '/tmp/src', '--status', 'archived']),
    ).toThrow('--status');
  });

  it('signals --help rather than failing', () => {
    expect(() => parseArgs(['--help'])).toThrow(HelpRequested);
  });

  it('rejects a bare argument', () => {
    expect(() => parseArgs(['import', '--source', '/tmp/src'])).toThrow(
      'Unexpected argument',
    );
  });
});
