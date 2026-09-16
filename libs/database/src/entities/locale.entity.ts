import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { TextDirection } from '@cms/domain';

/**
 * Languages live here as ROWS. Adding a language is an INSERT, never a
 * migration and never a new column — this is the central design decision of
 * the architecture (§4).
 */
@Entity({ name: 'locales' })
export class Locale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** BCP 47, e.g. `ar`, `en`, `fr`, `ar-SA`. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 35 })
  code: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ name: 'native_name', type: 'varchar', length: 128 })
  nativeName: string;

  @Column({ type: 'varchar', length: 3, default: 'ltr' })
  direction: TextDirection;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
