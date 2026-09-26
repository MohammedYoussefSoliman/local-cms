import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import type { ModuleScope } from '@cms/domain';

import { BaseEntity } from './base.entity';
import { LocalizationApp } from './localization-app.entity';
import { TranslationEntry } from './translation-entry.entity';

/**
 * A translation namespace (`products`, `checkout`, `authentication`).
 *
 * Named `TranslationModule` because `Module` is the NestJS decorator — an
 * entity called `Module` makes every `@Module()` import ambiguous.
 *
 * Scope invariant, enforced by CHECK constraints in the migration:
 *   scope = 'app'    ⇒ app_id IS NOT NULL
 *   scope = 'global' ⇒ app_id IS NULL
 */
@Entity({ name: 'modules' })
/**
 * The real index is PARTIAL (`WHERE app_id IS NOT NULL`), and there is a second
 * one, `uq_modules_global_slug`, partial on `scope = 'global'` — neither is
 * expressible in a decorator. `synchronize` is off so the difference is inert,
 * but a future `migration:generate` will read this decorator and offer to
 * replace the partial index with a plain one. Decline it; see `InitialSchema`.
 */
@Index('uq_modules_app_slug', ['appId', 'slug'], { unique: true })
export class TranslationModule extends BaseEntity {
  @Column({ name: 'app_id', type: 'uuid', nullable: true })
  appId: string | null;

  @ManyToOne(() => LocalizationApp, (app) => app.modules, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'app_id' })
  app: LocalizationApp | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Part of the runtime translation path — stable once published. */
  @Column({ type: 'varchar', length: 128 })
  slug: string;

  @Column({ type: 'varchar', length: 16, default: 'app' })
  scope: ModuleScope;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(() => TranslationEntry, (entry) => entry.module)
  entries: TranslationEntry[];
}
