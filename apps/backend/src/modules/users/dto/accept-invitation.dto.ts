import { IsString, Length } from 'class-validator';

import type { AcceptInvitationPayload } from '@cms/contracts';

/**
 * No `currentPassword`: the invitation token *is* the proof, and there is no
 * current password to prove anything with.
 */
export class AcceptInvitationDto implements AcceptInvitationPayload {
  /**
   * The same twelve-character floor `ChangePasswordDto` sets, so the first
   * password an account has is not weaker than every one after it.
   */
  @IsString()
  @Length(12, 512)
  password: string;
}
