import { Column, Entity, Index } from 'typeorm';

import type { UserRole, UserStatus } from '@cms/domain';

import { BaseEntity } from './base.entity';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  /** CITEXT so uniqueness is case-insensitive without a lower() index. */
  @Index({ unique: true })
  @Column({ type: 'citext' })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /**
   * Stored as varchar rather than a PG enum: roles are expected to grow
   * (reviewer, translator) and an enum change is a migration + table rewrite.
   */
  @Column({ type: 'varchar', length: 32, default: 'editor' })
  role: UserRole;

  @Column({ type: 'varchar', length: 32, default: 'invited' })
  status: UserStatus;

  /** Argon2/bcrypt hash. Never selected unless explicitly asked for. */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash: string;
}
