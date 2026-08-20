/** Flattens a nested message object into dot-joined keys (shared by tests and tooling). */
export function flattenKeys(messages: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      keys.push(path);
    } else if (value != null && typeof value === "object") {
      keys.push(...flattenKeys(value as Record<string, unknown>, path));
    }
  }
  return keys;
}
