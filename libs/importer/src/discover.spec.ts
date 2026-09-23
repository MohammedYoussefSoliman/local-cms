import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { DEFAULT_PATTERN, compilePattern, discover, slugify } from './discover';

describe('compilePattern', () => {
  it('turns the placeholders into a glob', () => {
    expect(compilePattern(DEFAULT_PATTERN).glob).toBe(
      'apps/*/src/modules/*/locales/*.ts',
    );
  });

  it('reads the names back out of a path', () => {
    const { matcher } = compilePattern(DEFAULT_PATTERN);

    expect(
      matcher.exec('apps/storefront/src/modules/Checkout/locales/ar.ts')?.groups,
    ).toEqual({ app: 'storefront', module: 'Checkout', locale: 'ar' });
  });

  it('does not match a path one directory off', () => {
    const { matcher } = compilePattern(DEFAULT_PATTERN);

    // The whole reason the template exists: a glob would have matched this and
    // filed `nested` as the module.
    expect(
      matcher.test('apps/storefront/src/modules/Checkout/nested/locales/ar.ts'),
    ).toBe(false);
  });

  it('escapes literal text rather than treating it as a pattern', () => {
    const { matcher } = compilePattern('<app>/<module>/<locale>.json');

    expect(matcher.test('shop/checkout/arxjson')).toBe(false);
    expect(matcher.test('shop/checkout/ar.json')).toBe(true);
  });

  it.each(['app', 'module', 'locale'])('rejects a template with no <%s>', (name) => {
    const template = DEFAULT_PATTERN.replace(`<${name}>`, 'fixed');

    expect(() => compilePattern(template)).toThrow(`<${name}>`);
  });

  it('rejects a repeated placeholder', () => {
    // Two capture groups of one name is a RegExp error; saying so here is more
    // useful than the engine's version of it.
    expect(() => compilePattern('<app>/<app>/<module>/<locale>.json')).toThrow(
      'only once',
    );
  });
});

describe('slugify', () => {
  it.each([
    ['Checkout', 'checkout'],
    ['ProductDetails', 'product-details'],
    ['order_history', 'order-history'],
    ['My  App!', 'my-app'],
  ])('turns %s into %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('discover', () => {
  it('finds the files the template accounts for and nothing else', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cms-importer-'));

    const write = (path: string): void => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), '{}');
    };

    write('apps/shop/src/modules/Checkout/locales/ar.json');
    write('apps/shop/src/modules/Checkout/locales/en.json');
    write('apps/shop/src/modules/Checkout/index.json');
    write('node_modules/other/apps/x/src/modules/y/locales/en.json');

    const files = await discover(
      root,
      'apps/<app>/src/modules/<module>/locales/<locale>.json',
    );

    expect(
      files.map((file) => `${file.app}/${file.module}/${file.locale}`),
    ).toEqual(['shop/Checkout/ar', 'shop/Checkout/en']);
  });
});
