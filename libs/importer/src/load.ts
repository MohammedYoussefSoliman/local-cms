import { readFileSync } from 'node:fs';

import type { SourceFile } from './discover';
import type { FindingKind } from './report';

/** `translation_entries.key` is varchar(255); a longer key cannot be stored. */
export const MAX_KEY_LENGTH = 255;

/** How a stage hands a problem back without knowing how it will be reported. */
export type ReportFn = (
  kind: FindingKind,
  detail: string,
  key?: string,
) => void;

export type LoadedFile = {
  file: SourceFile;
  /** Dotted key → string, in source order. */
  keys: Map<string, string>;
};

let typeScriptRegistered = false;

/**
 * Locale files in the source monorepo are `.ts`, not `.json` — they are typed
 * objects a bundler consumes. Reading them means evaluating them, so ts-node is
 * registered lazily: a `--pattern` pointed at JSON never pays for it.
 *
 * `transpileOnly` because the source repo's types are not this repo's problem;
 * a locale file that fails to typecheck against its own project still holds
 * perfectly importable strings.
 */
function registerTypeScript(): void {
  if (typeScriptRegistered) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tsNode = require('ts-node') as {
    register: (options: Record<string, unknown>) => unknown;
  };

  tsNode.register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', target: 'es2022' },
  });

  typeScriptRegistered = true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The translation tree a module file exports.
 *
 * A single named export is unwrapped (`export const en = {...}`), but only when
 * the module is an ES module — a CommonJS `module.exports = { common: {...} }`
 * has exactly one own key too, and unwrapping that would silently import the
 * `common` namespace as the whole file.
 */
function unwrap(loaded: unknown): unknown {
  if (!isRecord(loaded)) return loaded;
  if ('default' in loaded) return loaded.default;

  const named = Object.keys(loaded).filter((key) => key !== '__esModule');

  if (loaded.__esModule === true && named.length === 1) {
    return loaded[named[0]];
  }

  return loaded;
}

function readTree(path: string): unknown {
  if (path.endsWith('.json')) {
    return JSON.parse(readFileSync(path, 'utf8'));
  }

  registerTypeScript();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return unwrap(require(path));
}

/**
 * Nested source objects become stable dotted keys, which is the shape the CMS
 * stores and every i18n client already addresses (`checkout.summary.title`).
 *
 * Non-strings are reported and skipped rather than coerced: a `0` that arrives
 * as `"0"` reads as a translated string forever after, and nobody will know to
 * look at it again.
 */
export function flatten(tree: unknown, report: ReportFn): Map<string, string> {
  const keys = new Map<string, string>();

  const walk = (node: unknown, prefix: string): void => {
    if (typeof node === 'string') {
      if (prefix.length > MAX_KEY_LENGTH) {
        report(
          'key_too_long',
          `Key is ${prefix.length} characters; the column holds ${MAX_KEY_LENGTH}.`,
          prefix,
        );
        return;
      }

      if (keys.has(prefix)) {
        // Two source shapes collapsed onto one dotted key — `{ a: { b } }` and
        // `{ 'a.b': ... }` in the same file. First one wins, loudly.
        report(
          'duplicate_key',
          `Key appears twice once flattened; kept the first value.`,
          prefix,
        );
        return;
      }

      keys.set(prefix, node);
      return;
    }

    if (isRecord(node)) {
      for (const [name, child] of Object.entries(node)) {
        walk(child, prefix ? `${prefix}.${name}` : name);
      }
      return;
    }

    report(
      'non_string_value',
      `Value is ${Array.isArray(node) ? 'an array' : typeof node}, not a string; skipped.`,
      prefix,
    );
  };

  if (!isRecord(tree)) {
    report('unreadable_file', 'The file did not export an object of strings.');
    return keys;
  }

  walk(tree, '');

  return keys;
}

/** Reads and flattens one discovered file. Never throws; it reports instead. */
export function loadFile(file: SourceFile, report: ReportFn): LoadedFile {
  try {
    const keys = flatten(readTree(file.path), report);

    if (keys.size === 0) {
      report('empty_file', 'No translatable strings found.');
    }

    return { file, keys };
  } catch (error) {
    report(
      'unreadable_file',
      error instanceof Error ? error.message : String(error),
    );

    return { file, keys: new Map() };
  }
}
