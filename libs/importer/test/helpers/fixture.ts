import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type { CliOptions } from '../../src';

/** Relative path within the fake source repo → file contents. */
export type FixtureTree = Record<string, string>;

export type Fixture = {
  root: string;
  reportPath: string;
  /** The SHA the importer is expected to record, or null for a non-git tree. */
  sha: string | null;
  remove: () => void;
};

/**
 * A throwaway source repository on disk.
 *
 * A real git checkout, because the importer's audit trail is the source commit
 * SHA (invariant Rule 9) and a fixture that fakes it would not prove the thing
 * the rule is about.
 */
export function createFixture(
  files: FixtureTree,
  options: { git?: boolean } = {},
): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'cms-import-source-'));
  const reports = mkdtempSync(join(tmpdir(), 'cms-import-report-'));

  for (const [path, contents] of Object.entries(files)) {
    const target = resolve(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents, 'utf8');
  }

  let sha: string | null = null;

  if (options.git !== false) {
    const git = (...args: string[]): string =>
      execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

    git('init', '--quiet');
    git('add', '.');
    git(
      '-c',
      'user.email=e2e@example.test',
      '-c',
      'user.name=E2E',
      'commit',
      '--quiet',
      '--no-gpg-sign',
      '-m',
      'fixture',
    );

    sha = git('rev-parse', 'HEAD');
  }

  return {
    root,
    reportPath: join(reports, 'report.json'),
    sha,
    remove: () => {
      rmSync(root, { recursive: true, force: true });
      rmSync(reports, { recursive: true, force: true });
    },
  };
}

/** The CLI defaults, with the fixture wired in and JSON as the source format. */
export function fixtureOptions(
  fixture: Fixture,
  overrides: Partial<CliOptions> = {},
): CliOptions {
  return {
    source: fixture.root,
    pattern: 'apps/<app>/src/modules/<module>/locales/<locale>.json',
    reportPath: fixture.reportPath,
    defaultLocaleCode: 'en',
    status: 'published',
    commit: false,
    overwrite: false,
    strict: false,
    ...overrides,
  };
}
