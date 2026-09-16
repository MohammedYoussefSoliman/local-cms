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
