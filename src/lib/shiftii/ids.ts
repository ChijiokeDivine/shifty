export function nid(prefix: string): string {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${raw}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
