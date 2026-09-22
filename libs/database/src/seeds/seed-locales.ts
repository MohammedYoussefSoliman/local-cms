import { BOOTSTRAP_LOCALES, canonicalizeLocaleCode } from '@cms/domain';

import { Locale } from '../entities';

import type { DataSource } from 'typeorm';

const LOCALE_SEED: Record<
  (typeof BOOTSTRAP_LOCALES)[number],
  Pick<Locale, 'name' | 'nativeName' | 'direction'>
> = {
  ar: { name: 'Arabic', nativeName: 'العربية', direction: 'rtl' },
  en: { name: 'English', nativeName: 'English', direction: 'ltr' },
};

/**
 * Idempotent: re-running leaves existing locales untouched, so this is safe on
 * every deploy.
 */
export async function seedLocales(dataSource: DataSource): Promise<void> {
  const repository = dataSource.getRepository(Locale);

  for (const bootstrapCode of BOOTSTRAP_LOCALES) {
    // Canonicalized on the way in like every other writer, so the seeder can
    // never be the one that puts a second spelling of a language in the table.
    const code = canonicalizeLocaleCode(bootstrapCode);

    const existing = await repository.findOne({ where: { code } });
    if (existing) continue;
    await repository.save(
      repository.create({ code, ...LOCALE_SEED[bootstrapCode] }),
    );
  }
}
