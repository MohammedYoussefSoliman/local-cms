/**
 * The key an in-flight edit is stored under.
 *
 * A composite string rather than a nested map: the editor needs "is anything
 * dirty?" and "discard this one" to be O(1), and a nested object turns both
 * into a walk.
 */
export function cellKey(entryId: string, localeCode: string): string {
  return `${entryId}:${localeCode}`;
}
