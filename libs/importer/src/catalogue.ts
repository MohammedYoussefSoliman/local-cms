import { slugify } from './discover';

import type { SourceFile } from './discover';
import type { LoadedFile } from './load';
import type { Findings } from './report';

/** One app × one module, with every language that was found for it. */
export type SourceModule = {
  appName: string;
  appSlug: string;
  moduleName: string;
  moduleSlug: string;
  /** Locale code → dotted key → value. */
  byLocale: Map<string, Map<string, string>>;
  /** Locale code → the file it came from, so a finding can name the file. */
  files: Map<string, SourceFile>;
};

export type SourceCatalogue = Map<string, SourceModule>;

/**
 * Groups the flat list of files by the module they belong to, which is the unit
 * everything downstream works in: key parity is a property of a module, and so
 * is the `uq_entries_module_key` constraint the write pass leans on.
 */
export function collate(
  loaded: LoadedFile[],
  findings: Findings,
): SourceCatalogue {
  const catalogue: SourceCatalogue = new Map();

  for (const { file, keys } of loaded) {
    const appSlug = slugify(file.app);
    const moduleSlug = slugify(file.module);
    const identity = `${appSlug}/${moduleSlug}`;

    let entry = catalogue.get(identity);

    if (!entry) {
      entry = {
        appName: file.app,
        appSlug,
        moduleName: file.module,
        moduleSlug,
        byLocale: new Map(),
        files: new Map(),
      };
      catalogue.set(identity, entry);
    }

    if (entry.byLocale.has(file.locale)) {
      // `en.ts` and `en.json` both matching, or two directories that slugify
      // to the same name. Either way the second one is not imported, and
      // silently keeping one of the two is how half a module goes missing.
      findings.add({
        severity: 'error',
        kind: 'duplicate_file',
        file: file.relativePath,
        app: appSlug,
        module: moduleSlug,
        locale: file.locale,
        detail: `Already loaded from ${entry.files.get(file.locale)?.relativePath}; this file was skipped.`,
      });
      continue;
    }

    entry.byLocale.set(file.locale, keys);
    entry.files.set(file.locale, file);
  }

  return catalogue;
}

/**
 * Reports keys a module has in one language and not in another (arch doc §11
 * step 4).
 *
 * A warning, never a failure: a key translated into English and not yet into
 * Arabic is the normal state of a growing product, and an importer that
 * refuses the batch over it would never import anything. The CMS's own
 * "missing translations" view is the place that gap gets worked off.
 */
export function validateParity(
  catalogue: SourceCatalogue,
  findings: Findings,
): void {
  for (const module of catalogue.values()) {
    const locales = [...module.byLocale.keys()];
    if (locales.length < 2) continue;

    const union = new Set<string>();
    for (const keys of module.byLocale.values()) {
      for (const key of keys.keys()) union.add(key);
    }

    for (const locale of locales) {
      const keys = module.byLocale.get(locale);

      for (const key of union) {
        if (keys?.has(key)) continue;

        findings.add({
          severity: 'warning',
          kind: 'missing_key',
          file: module.files.get(locale)?.relativePath,
          app: module.appSlug,
          module: module.moduleSlug,
          locale,
          key,
          detail: 'Present in another language of this module, absent here.',
        });
      }
    }
  }
}

/** Every locale code the source names, in first-seen order. */
export function localeCodesIn(catalogue: SourceCatalogue): string[] {
  const codes = new Set<string>();

  for (const module of catalogue.values()) {
    for (const code of module.byLocale.keys()) codes.add(code);
  }

  return [...codes];
}

/** Total number of (key, locale) pairs the source holds. */
export function keyCountIn(catalogue: SourceCatalogue): number {
  let total = 0;

  for (const module of catalogue.values()) {
    for (const keys of module.byLocale.values()) total += keys.size;
  }

  return total;
}
