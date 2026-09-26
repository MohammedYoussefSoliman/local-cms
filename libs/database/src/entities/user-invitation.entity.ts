import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from './base.entity';
import { User } from './user.entity';

/**
 * A single-use credential that lets an `invited` account set its first
 * password and become `active`.
 *
 * `POST /users` creates an account whose password hash is over bytes that were
 * generated, used once and dropped — there is no password, rather than a
 * guessable one. Without this table that account could never log in, which is
 * the gap the delivery plan's B9 flagged and left open on purpose.
 *
 * Only the SHA-256 of the token is stored, exactly as `api_keys` and
 * `refresh_sessions` do. The plaintext is returned once, by the endpoint that
 * mints it, and is unrecoverable afterwards — a token this table could hand
 * back is an account takeover for anyone holding a database dump.
 */
@Entity({ name: 'user_invitations' })
export class UserInvitation extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /**
   * CASCADE rather than SET NULL: an invitation with no account to accept into
   * is not an audit record, it is a dangling credential.
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index('uq_user_invitations_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  /** Set once, by acceptance. A second accept with the same token is a 401. */
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  /**
   * Set by re-issuing or by cancelling. The row survives so that "who invited
   * this person, and how many times" stays answerable.
   */
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'invited_by', type: 'uuid', nullable: true })
  invitedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invited_by' })
  invitedByUser: User | null;
}
