import { resolve } from 'node:path';

import fg from 'fast-glob';

/**
 * The layout of the frontend monorepo this importer exists to drain — feature
 * modules under `src/modules/{Name}/` with a `locales/` folder, which is the
 * convention `.claude/rules/global-*.md` describes.
 */
export const DEFAULT_PATTERN =
  'apps/<app>/src/modules/<module>/locales/<locale>.ts';

const PLACEHOLDERS = ['app', 'module', 'locale'] as const;

export type SourceFile = {
  /** Absolute, for reading. */
  path: string;
  /** Source-root-relative, which is what the report quotes. */
  relativePath: string;
  app: string;
  module: string;
  locale: string;
};

/**
 * Turns a path template into the glob that finds files and the expression that
 * reads the names back out of a match.
 *
 * A template rather than a bare glob because a glob cannot say which `*` is the
 * application and which is the module. Guessing from position is how an
 * importer silently files every module under the wrong app the first time a
 * source repo nests one level deeper.
 */
export function compilePattern(template: string): {
  glob: string;
  matcher: RegExp;
} {
  for (const name of PLACEHOLDERS) {
    const occurrences = template.split(`<${name}>`).length - 1;

    if (occurrences === 0) {
      throw new Error(
        `The path template must contain <${name}>; got "${template}".`,
      );
    }

    if (occurrences > 1) {
      throw new Error(
        `The path template may contain <${name}> only once; got "${template}".`,
      );
    }
  }

  const glob = template.replace(/<(?:app|module|locale)>/g, '*');

  const source = template
    // Split on the placeholders, keeping them, so literal text can be escaped
    // and placeholders can become capture groups in one pass.
    .split(/(<app>|<module>|<locale>)/)
    .map((part) =>
      /^<(?:app|module|locale)>$/.test(part)
        ? `(?<${part.slice(1, -1)}>[^/]+)`
        : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('');

  return { glob, matcher: new RegExp(`^${source}$`) };
}

/** Every locale file under `root` that the template accounts for. */
export async function discover(
  root: string,
  template: string,
): Promise<SourceFile[]> {
  const { glob, matcher } = compilePattern(template);

  const paths = await fg(glob, {
    cwd: root,
    onlyFiles: true,
    // `node_modules` under a source monorepo holds thousands of locale files
    // belonging to other people's packages.
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  });

  const files: SourceFile[] = [];

  for (const relativePath of paths.sort()) {
    const groups = matcher.exec(relativePath)?.groups;
    if (!groups) continue;

    files.push({
      path: resolve(root, relativePath),
      relativePath,
      app: groups.app,
      module: groups.module,
      locale: groups.locale,
    });
  }

  return files;
}

/**
 * `ProductDetails` → `product-details`. Directory names are the source of both
 * the slug (which appears in runtime URLs and is immutable, invariant Rule 8)
 * and the display name, so the two are derived here rather than typed twice.
 */
export function slugify(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
