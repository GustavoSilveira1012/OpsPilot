export const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1'
).replace(/\/$/, '');

/** Extracts a readable message from a NestJS error body ({ message: string | string[] }). */
export async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();

    if (typeof body === 'object' && body !== null && 'message' in body) {
      const { message } = body;

      if (Array.isArray(message)) {
        return message.join(' ');
      }

      if (typeof message === 'string') {
        return message;
      }
    }
  } catch {
    // Non-JSON error body.
  }

  return fallback;
}
