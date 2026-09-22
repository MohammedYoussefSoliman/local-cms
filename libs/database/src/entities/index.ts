export * from './api-key.entity';
export * from './app-locale.entity';
export * from './base.entity';
export * from './locale.entity';
export * from './localization-app.entity';
export * from './refresh-session.entity';
export * from './translation-entry.entity';
export * from './translation-module.entity';
export * from './translation-value-version.entity';
export * from './translation-value.entity';
export * from './user.entity';

import { ApiKey } from './api-key.entity';
import { AppLocale } from './app-locale.entity';
import { Locale } from './locale.entity';
import { LocalizationApp } from './localization-app.entity';
import { RefreshSession } from './refresh-session.entity';
import { TranslationEntry } from './translation-entry.entity';
import { TranslationModule } from './translation-module.entity';
import { TranslationValueVersion } from './translation-value-version.entity';
import { TranslationValue } from './translation-value.entity';
import { User } from './user.entity';

/**
 * The entity list TypeORM registers. Explicit rather than derived from the
 * barrel, because `BaseEntity` is abstract and has no `@Entity()` — handing it
 * to TypeORM fails at connection time with "No metadata for BaseEntity".
 *
 * Add every new entity here as well as to the exports above.
 */
export const ENTITIES = [
  ApiKey,
  AppLocale,
  Locale,
  LocalizationApp,
  RefreshSession,
  TranslationEntry,
  TranslationModule,
  TranslationValue,
  TranslationValueVersion,
  User,
];
