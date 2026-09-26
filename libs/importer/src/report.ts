import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * How much a finding matters.
 *
 * `error` means the thing it names was **skipped**, not that the run stopped —
 * an import of thousands of keys that aborts on the first bad one is an import
 * nobody can finish. `--strict` is the flag for callers who disagree.
 */
export type FindingSeverity = 'error' | 'warning' | 'info';

export type FindingKind =
  /** The file could not be read or evaluated at all. */
  | 'unreadable_file'
  /** Parsed, but held no translatable strings. */
  | 'empty_file'
  /** The path named a locale the `locales` table does not have. */
  | 'unknown_locale'
  /** A leaf that is not a string — numbers, arrays, nulls. */
  | 'non_string_value'
  /** Two source shapes flattened onto the same dotted key. */
  | 'duplicate_key'
  /** Two source files claim the same app, module and locale. */
  | 'duplicate_file'
  /** Longer than `translation_entries.key` (varchar 255). */
  | 'key_too_long'
  /** Present in one locale of a module and absent from another. */
  | 'missing_key'
  /** The CMS already holds a different string for this entry and locale. */
  | 'conflict'
  /** The importer switched a language on for an app that did not serve it. */
  | 'locale_enabled'
  /** The app has this language switched off, so the import will not be served. */
  | 'locale_disabled'
  /** The source tree is not a git checkout, so the run is not attributable. */
  | 'no_source_commit'
  /** The source tree has uncommitted changes, so the SHA under-describes it. */
  | 'dirty_source_tree';

export type Finding = {
  severity: FindingSeverity;
  kind: FindingKind;
  /** Source-relative path, where the finding came from a file. */
  file?: string;
  app?: string;
  module?: string;
  locale?: string;
  key?: string;
  detail: string;
};

export type ImportCounts = {
  apps: number;
  modules: number;
  entries: number;
  values: number;
  versions: number;
  unchanged: number;
};

export type ImportReport = {
  startedAt: string;
  finishedAt: string | null;
  mode: 'dry-run' | 'commit';
  source: {
    root: string;
    pattern: string;
    /** Rule 9: every run is attributable to a source revision. */
    commitSha: string | null;
    dirty: boolean;
  };
  discovered: {
    files: number;
    apps: string[];
    modules: number;
    locales: string[];
    keys: number;
  };
  /**
   * Null until the write pass has run. In a dry run these are the counts the
   * rolled-back transaction produced — that is, exactly what `--commit` would
   * have written, which is the only honest thing a dry run can report.
   */
  written: ImportCounts | null;
  findings: Finding[];
  summary: Record<string, number>;
};

/** Accumulates findings so every stage reports the same way. */
export class Findings {
  private readonly entries: Finding[] = [];

  add(finding: Finding): void {
    this.entries.push(finding);
  }

  all(): Finding[] {
    return this.entries;
  }

  count(severity: FindingSeverity): number {
    return this.entries.filter((finding) => finding.severity === severity)
      .length;
  }

  summary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const finding of this.entries) {
      summary[finding.kind] = (summary[finding.kind] ?? 0) + 1;
    }
    return summary;
  }
}

/**
 * The source revision this run imported from (invariant Rule 9).
 *
 * `dirty` is reported alongside it because a SHA taken from a working tree
 * with uncommitted edits does not describe what was actually read — and an
 * audit trail that quietly says otherwise is worse than none.
 */
export function readSourceCommit(root: string): {
  sha: string | null;
  dirty: boolean;
} {
  const git = (args: string[]): string =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

  try {
    return { sha: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']) !== '' };
  } catch {
    return { sha: null, dirty: false };
  }
}

/** Writes the report to disk, creating its directory. */
export function writeReport(path: string, report: ImportReport): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

/** The human-readable end of a run — what someone reads before deciding. */
export function renderSummary(report: ImportReport): string {
  const lines: string[] = [];
  const { discovered, written, source } = report;

  lines.push(
    `${report.mode === 'commit' ? 'Imported' : 'Dry run'} from ${source.root}`,
  );
  lines.push(
    `  source commit  ${source.commitSha ?? 'unknown (not a git checkout)'}${
      source.dirty ? ' [dirty tree]' : ''
    }`,
  );
  lines.push(
    `  discovered     ${discovered.files} files · ${discovered.apps.length} apps · ${discovered.modules} modules · ${discovered.locales.join(', ')} · ${discovered.keys} keys`,
  );

  if (written) {
    lines.push(
      `  written        ${written.apps} apps · ${written.modules} modules · ${written.entries} entries · ${written.values} values · ${written.versions} history rows`,
    );
    lines.push(`  unchanged      ${written.unchanged} values`);
  }

  const summary = Object.entries(report.summary);
  lines.push(
    summary.length === 0
      ? '  findings       none'
      : `  findings       ${summary.map(([kind, count]) => `${kind}=${count}`).join(' · ')}`,
  );

  return lines.join('\n');
}
