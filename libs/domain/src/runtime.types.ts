/**
 * The shape the runtime read APIs return and i18next consumes:
 * `{ products: { add_to_cart: 'Add to cart' } }`.
 *
 * Note this is keyed by module slug then entry key — NOT by locale. One
 * request returns one locale, named in the URL.
 */
export type TranslationBundle = Record<string, Record<string, string>>;

export type TranslationBundleResponse = {
  appSlug: string;
  localeCode: string;
  /** Changes whenever any value in the bundle is published. Drives ETag. */
  releaseId: string;
  bundle: TranslationBundle;
};

/**
 * Order in which a key is resolved. Documented here because the dashboard,
 * the runtime API, and the i18n client adapter must all agree on it.
 */
export const RESOLUTION_ORDER = [
  'app-specific entry',
  'global entry',
  'configured fallback locale',
  'translation key',
] as const;
