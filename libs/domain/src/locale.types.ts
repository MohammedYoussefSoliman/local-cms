/**
 * Languages are rows in the `locales` table, never columns and never a
 * compile-time union — adding French must not require a migration or a
 * TypeScript change. See `.claude/rules/cms-domain-invariants.md`.
 */
export type TextDirection = 'ltr' | 'rtl';

export type Locale = {
  id: string;
  /** BCP 47 code, e.g. `ar`, `en`, `fr`, `ar-SA`. Unique. */
  code: string;
  /** English name, e.g. "Arabic". */
  name: string;
  /** Endonym, e.g. "العربية". */
  nativeName: string;
  direction: TextDirection;
  isActive: boolean;
};

/**
 * Bootstrap locales only. These seed the `locales` table on a fresh install;
 * they are NOT the source of truth at runtime and must never be used to key a
 * persisted type.
 */
export const BOOTSTRAP_LOCALES = ['ar', 'en'] as const;

/**
 * BCP 47 canonical casing: language subtag lowercase, region subtag
 * uppercase, script subtag title case — `ar`, `pt-BR`, `zh-Hans-CN`.
 *
 * This is not cosmetic. `locales.code` is a plain `varchar`, so
 * `uq_locales_code` is case-SENSITIVE: without canonicalization `en` and `EN`
 * both insert, and a runtime request for one of them resolves nothing. Every
 * writer of a locale code — the API, the importer, the seeder — goes through
 * here so there is exactly one spelling of a language in the database.
 */
export function canonicalizeLocaleCode(code: string): string {
  return code
    .trim()
    .split('-')
    .map((subtag, index) => {
      if (index === 0) return subtag.toLowerCase();
      // 2 chars is a region (SA), 4 is a script (Hans); anything else —
      // variants, extensions — is lowercase by convention.
      if (subtag.length === 2) return subtag.toUpperCase();
      if (subtag.length === 4)
        return subtag[0].toUpperCase() + subtag.slice(1).toLowerCase();
      return subtag.toLowerCase();
    })
    .join('-');
}
