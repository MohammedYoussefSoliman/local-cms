import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';

import type { ContentType } from '@cms/domain';

import { BaseEntity } from './base.entity';
import { TranslationModule } from './translation-module.entity';
import { TranslationValue } from './translation-value.entity';
import { User } from './user.entity';

/**
 * The language-independent identity of a piece of copy.
 *
 * Deliberately has no `app_id`: the module already determines app vs global
 * scope, and a duplicated foreign key is a second source of truth that can
 * disagree with the first (arch doc §6).
 */
@Entity({ name: 'translation_entries' })
@Unique('uq_entries_module_key', ['moduleId', 'key'])
export class TranslationEntry extends BaseEntity {
  @Index()
  @Column({ name: 'module_id', type: 'uuid' })
  moduleId: string;

  @ManyToOne(() => TranslationModule, (module) => module.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'module_id' })
  module: TranslationModule;

  /** Stable key within the module, e.g. `add_to_cart`. */
  @Column({ type: 'varchar', length: 255 })
  key: string;

  /** Context for translators — shown in the dashboard editor. */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'content_type',
    type: 'varchar',
    length: 32,
    default: 'text',
  })
  contentType: ContentType;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  @OneToMany(() => TranslationValue, (value) => value.entry)
  values: TranslationValue[];
}
