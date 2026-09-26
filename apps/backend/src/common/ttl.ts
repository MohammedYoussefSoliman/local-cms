/**
 * Parses the `15m` / `30d` form the TTL environment variables use into
 * seconds.
 *
 * Shared rather than duplicated: `AuthService` reads `JWT_ACCESS_TTL` and
 * `InvitationsService` reads `INVITE_TTL`, and two parsers for one format is
 * how `7d` eventually means a week in one place and seven seconds in the
 * other.
 *
 * A bare number is accepted and read as seconds, so an operator who sets
 * `INVITE_TTL=3600` gets an hour rather than a silent zero.
 */
export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return Number(ttl) || 0;

  const amount = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit];

  return amount * multiplier;
}
