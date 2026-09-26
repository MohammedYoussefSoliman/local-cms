import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { Locale } from './locale.entity';
import { LocalizationApp } from './localization-app.entity';

/** Which languages an app has switched on, and how each one falls back. */
@Entity({ name: 'app_locales' })
@Unique('uq_app_locales_app_locale', ['appId', 'localeId'])
export class AppLocale {
  @PrimaryColumn({ name: 'app_id', type: 'uuid' })
  appId: string;

  @PrimaryColumn({ name: 'locale_id', type: 'uuid' })
  localeId: string;

  @ManyToOne(() => LocalizationApp, (app) => app.appLocales, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'app_id' })
  app: LocalizationApp;

  @ManyToOne(() => Locale, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'locale_id' })
  locale: Locale;

  /** Exactly one per app — enforced by a partial unique index in the migration. */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({ name: 'fallback_locale_id', type: 'uuid', nullable: true })
  fallbackLocaleId: string | null;

  /**
   * Relation over the column above, so a read can report the fallback's *code*
   * without a second round trip. `ON DELETE SET NULL` matches the FK already in
   * `InitialSchema` — this adds no schema, only a join TypeORM can plan.
   */
  @ManyToOne(() => Locale, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'fallback_locale_id' })
  fallbackLocale: Locale | null;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;
}
