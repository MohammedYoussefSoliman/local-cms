import { collate, keyCountIn, localeCodesIn, validateParity } from './catalogue';
import { Findings } from './report';

import type { LoadedFile } from './load';

function loaded(
  app: string,
  module: string,
  locale: string,
  keys: Record<string, string>,
): LoadedFile {
  return {
    file: {
      path: `/src/apps/${app}/src/modules/${module}/locales/${locale}.json`,
      relativePath: `apps/${app}/src/modules/${module}/locales/${locale}.json`,
      app,
      module,
      locale,
    },
    keys: new Map(Object.entries(keys)),
  };
}

describe('collate', () => {
  it('groups files by app and module, slugifying both', () => {
    const findings = new Findings();

    const catalogue = collate(
      [
        loaded('Storefront', 'ProductDetails', 'en', { title: 'Title' }),
        loaded('Storefront', 'ProductDetails', 'ar', { title: 'عنوان' }),
      ],
      findings,
    );

    expect([...catalogue.keys()]).toEqual(['storefront/product-details']);
    expect(localeCodesIn(catalogue)).toEqual(['en', 'ar']);
    expect(keyCountIn(catalogue)).toBe(2);
    expect(findings.all()).toEqual([]);
  });

  it('reports a second file claiming the same app, module and locale', () => {
    const findings = new Findings();

    const catalogue = collate(
      [
        loaded('shop', 'checkout', 'en', { a: 'first' }),
        loaded('Shop', 'Checkout', 'en', { a: 'second' }),
      ],
      findings,
    );

    // Both slugify to `shop/checkout`; keeping one silently loses the other.
    expect(catalogue.get('shop/checkout')?.byLocale.get('en')?.get('a')).toBe(
      'first',
    );
    expect(findings.all().map((finding) => finding.kind)).toEqual([
      'duplicate_file',
    ]);
  });
});

describe('validateParity', () => {
  it('reports a key one language has and another does not', () => {
    const findings = new Findings();

    const catalogue = collate(
      [
        loaded('shop', 'checkout', 'en', { title: 'Title', cta: 'Pay' }),
        loaded('shop', 'checkout', 'ar', { title: 'عنوان' }),
      ],
      findings,
    );

    validateParity(catalogue, findings);

    expect(findings.all()).toEqual([
      expect.objectContaining({
        severity: 'warning',
        kind: 'missing_key',
        locale: 'ar',
        key: 'cta',
      }),
    ]);
  });

  it('says nothing about a module that only ships one language', () => {
    const findings = new Findings();

    validateParity(
      collate([loaded('shop', 'checkout', 'en', { a: 'A' })], findings),
      findings,
    );

    expect(findings.all()).toEqual([]);
  });
});
