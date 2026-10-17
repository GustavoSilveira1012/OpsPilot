export function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL must be an HTTP API base URL.');
  }
  return value.replace(/\/$/, '');
}
