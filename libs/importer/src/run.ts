import { statSync } from 'node:fs';

import { collate, keyCountIn, localeCodesIn, validateParity } from './catalogue';
import { discover } from './discover';
import { runImport } from './import';
import { loadFile } from './load';
import { Findings, readSourceCommit, writeReport } from './report';

import type { CliOptions } from './options';
import type { ImportReport } from './report';
import type { DataSource } from 'typeorm';

export type PipelineResult = {
  report: ImportReport;
  reportPath: string;
};

/**
 * The whole pipeline (arch doc §11), in the order the steps have to happen:
 * discover, parse, flatten, validate, **report**, then write.
 *
 * The report is written to disk before the database is touched at all, so a run
 * that dies mid-transaction still leaves behind the record of what it set out
 * to do (invariant Rule 9). It is written a second time at the end, with the
 * counts and with anything the write pass found.
 */
export async function runPipeline(
  options: CliOptions,
  dataSource: DataSource,
): Promise<PipelineResult> {
  const startedAt = new Date().toISOString();
  const findings = new Findings();

  if (!isDirectory(options.source)) {
    throw new Error(`--source "${options.source}" is not a directory.`);
  }

  const commit = readSourceCommit(options.source);

  if (!commit.sha) {
    findings.add({
      severity: 'warning',
      kind: 'no_source_commit',
      detail: `${options.source} is not a git checkout, so this import cannot be traced to a source revision.`,
    });
  } else if (commit.dirty) {
    findings.add({
      severity: 'warning',
      kind: 'dirty_source_tree',
      detail: `${commit.sha} has uncommitted changes, so it does not fully describe what was imported.`,
    });
  }

  const files = await discover(options.source, options.pattern);

  if (files.length === 0) {
    throw new Error(
      `No files under "${options.source}" match the pattern "${options.pattern}".`,
    );
  }

  const loaded = files.map((file) =>
    loadFile(file, (kind, detail, key) =>
      findings.add({
        severity:
          kind === 'unreadable_file' || kind === 'key_too_long'
            ? 'error'
            : 'warning',
        kind,
        file: file.relativePath,
        app: file.app,
        module: file.module,
        locale: file.locale,
        ...(key ? { key } : {}),
        detail,
      }),
    ),
  );

  const catalogue = collate(loaded, findings);
  validateParity(catalogue, findings);

  const report: ImportReport = {
    startedAt,
    finishedAt: null,
    mode: options.commit ? 'commit' : 'dry-run',
    source: {
      root: options.source,
      pattern: options.pattern,
      commitSha: commit.sha,
      dirty: commit.dirty,
    },
    discovered: {
      files: files.length,
      apps: [...new Set([...catalogue.values()].map((entry) => entry.appSlug))],
      modules: catalogue.size,
      locales: localeCodesIn(catalogue),
      keys: keyCountIn(catalogue),
    },
    written: null,
    findings: findings.all(),
    summary: findings.summary(),
  };

  writeReport(options.reportPath, report);

  if (options.strict && findings.count('error') > 0) {
    throw new Error(
      `--strict: ${findings.count('error')} error findings; nothing was written. See ${options.reportPath}.`,
    );
  }

  report.written = await runImport(
    dataSource,
    catalogue,
    {
      commit: options.commit,
      defaultLocaleCode: options.defaultLocaleCode,
      status: options.status,
      overwrite: options.overwrite,
      changeNote: `Imported from ${options.source} @ ${commit.sha ?? 'unknown revision'}`,
    },
    findings,
  );

  report.finishedAt = new Date().toISOString();
  report.summary = findings.summary();

  writeReport(options.reportPath, report);

  return { report, reportPath: options.reportPath };
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
