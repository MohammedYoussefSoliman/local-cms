import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts one route out of the global JWT guard.
 *
 * Only login, refresh, and health may carry it. Marking anything else public
 * is the single fastest way to leak the CMS, so `@Public()` is treated as a
 * review-blocking change — see `.claude/rules/nestjs-auth.md`.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
