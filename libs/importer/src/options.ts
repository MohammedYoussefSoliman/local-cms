import { resolve } from 'node:path';

import type { TranslationStatus } from '@cms/domain';

import { DEFAULT_PATTERN } from './discover';


export type CliOptions = {
  /** Absolute path to the monorepo being drained. */
  source: string;
  pattern: string;
  reportPath: string;
  defaultLocaleCode: string;
  status: TranslationStatus;
  commit: boolean;
  overwrite: boolean;
  strict: boolean;
};

export const USAGE = `
cms-import — hydrate the Localization CMS from an existing monorepo's locale files

  pnpm import:cms --source ../yamm-client-monorepo [options]

  (the suffix is deliberate: "pnpm import" is a built-in pnpm command)

Options
  --source <path>           Root of the source repository. Required.
  --pattern <template>      Path template naming <app>, <module> and <locale>.
                            Default: ${DEFAULT_PATTERN}
  --report <path>           Where the run's report is written.
                            Default: ./import-reports/import-<timestamp>.json
  --default-locale <code>   Default language for apps this run creates. Default: en
  --status <draft|published>
                            Status for values this run writes. Default: published —
                            the copy being imported is already live in the source app,
                            and importing it as a draft would empty the runtime bundle.
  --commit                  Actually write. Without it nothing is kept.
  --dry-run                 The default; the explicit form of it.
  --overwrite               Replace a CMS value that differs from the source.
                            Off by default: after the first import the CMS is the
                            source of truth, and an editor's fix must not be undone
                            by a re-run.
  --strict                  Refuse to write if the report holds any error finding.
  -h, --help                Print this.
`;

const STATUSES: TranslationStatus[] = ['draft', 'published'];

/**
 * Hand-rolled rather than commander: the whole surface is nine flags, and a CLI
 * argument parser is a dependency this package would carry into every install
 * for the rest of its life.
 */
export function parseArgs(argv: string[]): CliOptions {
  const values = new Map<string, string | true>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith('--') && argument !== '-h') {
      throw new Error(`Unexpected argument "${argument}".`);
    }

    const [name, inlineValue] = splitFlag(argument);
    const next = argv[index + 1];

    if (inlineValue !== undefined) {
      values.set(name, inlineValue);
      continue;
    }

    if (next !== undefined && !next.startsWith('-')) {
      values.set(name, next);
      index += 1;
      continue;
    }

    values.set(name, true);
  }

  if (values.has('help') || values.has('h')) {
    throw new HelpRequested();
  }

  const source = values.get('source');

  if (typeof source !== 'string') {
    throw new Error('--source <path> is required.');
  }

  const status = (values.get('status') ?? 'published') as TranslationStatus;

  if (!STATUSES.includes(status)) {
    throw new Error(
      `--status must be one of ${STATUSES.join(', ')}; got "${String(status)}".`,
    );
  }

  const report = values.get('report');

  return {
    source: resolve(source),
    pattern: stringOr(values.get('pattern'), DEFAULT_PATTERN),
    reportPath:
      typeof report === 'string' ? resolve(report) : defaultReportPath(),
    defaultLocaleCode: stringOr(values.get('default-locale'), 'en'),
    status,
    // `--dry-run` is not merely the default, it overrides `--commit`: the safe
    // reading of "both were passed" is the one that writes nothing.
    commit: values.get('commit') === true && values.get('dry-run') !== true,
    overwrite: values.get('overwrite') === true,
    strict: values.get('strict') === true,
  };
}

/** Thrown for `--help`, so the caller can exit 0 rather than treat it as an error. */
export class HelpRequested extends Error {}

function splitFlag(argument: string): [string, string | undefined] {
  const bare = argument.replace(/^--?/, '');
  const equals = bare.indexOf('=');

  return equals === -1
    ? [bare, undefined]
    : [bare.slice(0, equals), bare.slice(equals + 1)];
}

function stringOr(value: string | true | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function defaultReportPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return resolve(process.cwd(), 'import-reports', `import-${stamp}.json`);
}
