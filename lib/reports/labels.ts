/**
 * A report's display name out of a locale bundle. The registry key ("hours.by_project") is
 * stored nested under `reports.names`, because a dot inside a message key is read as a path
 * and the lookup would never match.
 */
export function reportTitle(names: Record<string, Record<string, string>>, key: string): string {
  const [group, ...rest] = key.split(".");
  return names[group ?? ""]?.[rest.join(".")] ?? key;
}
