import 'reflect-metadata';

import { AppDataSource } from '@cms/database/src/data-source';

import { HelpRequested, USAGE, parseArgs } from './options';
import { renderSummary } from './report';
import { runPipeline } from './run';

/**
 * `no-console` allows only `warn` and `error`, and neither is what a CLI's
 * ordinary output is. Writing to the stream directly is the honest form of it
 * and keeps the summary on stdout where a pipe can read it.
 */
function print(text: string): void {
  process.stdout.write(`${text}\n`);
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));

  await AppDataSource.initialize();

  try {
    const { report, reportPath } = await runPipeline(options, AppDataSource);

    print(renderSummary(report));
    print(`  report         ${reportPath}`);

    if (!options.commit) {
      print('\nNothing was written. Re-run with --commit to keep it.');
    }

    return 0;
  } finally {
    await AppDataSource.destroy();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    if (error instanceof HelpRequested) {
      print(USAGE);
      process.exit(0);
    }

    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
