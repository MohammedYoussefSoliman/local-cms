import { IsString, Length } from 'class-validator';

import type { ChangePasswordPayload } from '@cms/contracts';

export class ChangePasswordDto implements ChangePasswordPayload {
  @IsString()
  @Length(1, 512)
  currentPassword: string;

  /**
   * Twelve characters minimum. Long enough to be worth argon2's cost, short
   * enough that nobody reaches for a sticky note — and the upper bound exists
   * because argon2 hashes whatever it is handed, including a 10MB paste.
   */
  @IsString()
  @Length(12, 512)
  newPassword: string;
}
