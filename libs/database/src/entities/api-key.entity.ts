import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from './base.entity';
import { LocalizationApp } from './localization-app.entity';
import { User } from './user.entity';

/**
 * A service credential: how a client application authenticates to the runtime
 * read API, with no CMS user account behind it.
 *
 * Only the SHA-256 of the key is stored. The plaintext is returned exactly once,
 * by the endpoint that creates it, and is unrecoverable afterwards — a key this
 * table could hand back is a key a database dump hands to everyone.
 */
@Entity({ name: 'api_keys' })
export class ApiKey extends BaseEntity {
  /**
   * NOT NULL deliberately: a key is scoped to exactly one app, so a leaked key
   * cannot read another app's content.
   */
  @Column({ name: 'app_id', type: 'uuid' })
  appId: string;

  @ManyToOne(() => LocalizationApp, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  app: LocalizationApp;

  /** What it is for, e.g. "storefront web". Shown in the dashboard. */
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index('uq_api_keys_key_hash', { unique: true })
  @Column({ name: 'key_hash', type: 'varchar', length: 255 })
  keyHash: string;

  /**
   * The leading, non-secret segment of the key. It is what the dashboard and
   * the logs display, and it is the only way to tell two keys apart once the
   * plaintext is gone.
   */
  @Column({ type: 'varchar', length: 12 })
  prefix: string;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  /**
   * Revocation sets this rather than deleting the row: `last_used_at` and the
   * creator survive for the audit, which is most of the point of having asked
   * who made the key.
   */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;
}
