import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { AppLocale } from './app-locale.entity';
import { BaseEntity } from './base.entity';
import { Locale } from './locale.entity';
import { TranslationModule } from './translation-module.entity';

/**
 * Named `LocalizationApp`, not `App`, so it never reads as the NestJS
 * application in `app.module.ts`. Table stays `apps`.
 */
@Entity({ name: 'apps' })
export class LocalizationApp extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Appears in runtime URLs (`/v1/apps/:appSlug/...`), so it is immutable. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'default_locale_id', type: 'uuid' })
  defaultLocaleId: string;

  @ManyToOne(() => Locale, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'default_locale_id' })
  defaultLocale: Locale;

  @OneToMany(() => AppLocale, (appLocale) => appLocale.app)
  appLocales: AppLocale[];

  @OneToMany(() => TranslationModule, (module) => module.app)
  modules: TranslationModule[];
}
