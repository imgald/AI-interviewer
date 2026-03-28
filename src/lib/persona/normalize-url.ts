export function normalizeUrl(input: string) {
  const url = new URL(input.trim());
  url.hash = "";
  return url.toString();
}
