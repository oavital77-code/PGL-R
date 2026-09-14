import { sql, type AnyColumn } from "drizzle-orm";
import { getTableName } from "drizzle-orm";

/**
 * Fully-qualified column reference for use inside *correlated sub-queries*.
 * Drizzle renders `${table.col}` unqualified when the column belongs to the outer
 * "from" table, which silently binds to the inner alias instead – use this there.
 */
export function outer(column: AnyColumn) {
  const table = getTableName(column.table);
  return sql.raw(`"${table}"."${column.name}"`);
}
