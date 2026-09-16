import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
  VersionColumn,
} from 'typeorm';

import type { TranslationStatus } from '@cms/domain';

import { BaseEntity } from './base.entity';
import { Locale } from './locale.entity';
import { TranslationEntry } from './translation-entry.entity';
import { User } from './user.entity';

/**
 * One localized string: exactly one entry × one locale. This is the row that
 * replaces a per-language column — the whole point of §4.
 */
@Entity({ name: 'translation_values' })
@Unique('uq_values_entry_locale', ['entryId', 'localeId'])
@Index('ix_values_status', ['status'])
export class TranslationValue extends BaseEntity {
  @Index()
  @Column({ name: 'entry_id', type: 'uuid' })
  entryId: string;

  @ManyToOne(() => TranslationEntry, (entry) => entry.values, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entry_id' })
  entry: TranslationEntry;

  @Column({ name: 'locale_id', type: 'uuid' })
  localeId: string;

  @ManyToOne(() => Locale, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'locale_id' })
  locale: Locale;

  @Column({ type: 'text' })
  value: string;

  /** Runtime APIs return `published` rows only. */
  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: TranslationStatus;

  /**
   * TypeORM bumps this on every save and throws on a stale write, which is
   * what makes two editors on the same key safe. Never set it by hand.
   */
  @VersionColumn({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'updated_by' })
  updatedByUser: User | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
