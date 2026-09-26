/**
 * Reads a `dataKey` off a row. Kept as a function rather than inlined so the
 * table never assumes the key exists — a column may be formatter-only.
 */
export function getCellValue<T>(row: T, key?: keyof T & string): unknown {
  if (!key) return undefined;
  return row[key];
}
