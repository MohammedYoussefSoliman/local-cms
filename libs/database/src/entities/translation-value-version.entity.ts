import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { TranslationStatus } from '@cms/domain';

import { TranslationValue } from './translation-value.entity';
import { User } from './user.entity';

/**
 * Append-only history backing audit and rollback. Nothing in the application
 * may UPDATE or DELETE a row here — a correction is a new row.
 */
@Entity({ name: 'translation_value_versions' })
@Index('ix_value_versions_value_version', ['translationValueId', 'version'])
export class TranslationValueVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'translation_value_id', type: 'uuid' })
  translationValueId: string;

  @ManyToOne(() => TranslationValue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'translation_value_id' })
  translationValue: TranslationValue;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'varchar', length: 16 })
  status: TranslationStatus;

  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'changed_by' })
  changedByUser: User | null;

  @Column({ name: 'change_note', type: 'text', nullable: true })
  changeNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
