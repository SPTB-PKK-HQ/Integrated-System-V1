const SCRIPT_URL = process.env.NEXT_PUBLIC_SCRIPT_URL || '';
const SCRIPT_URL_POST = SCRIPT_URL + '?';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export class GasApiError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'GasApiError';
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) return response;

      if (response.status === 503) {
        const backoff = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }

      throw new GasApiError(`HTTP error! status: ${response.status}`, response.status);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxRetries) throw lastError;
      const backoff = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }

  throw lastError || new GasApiError('Max retries exceeded');
}

export async function gasPost<T>(body: Record<string, unknown>): Promise<T> {
  if (!SCRIPT_URL) throw new GasApiError('NEXT_PUBLIC_SCRIPT_URL is not configured');
  const response = await fetchWithRetry(SCRIPT_URL_POST, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  return response.json();
}

export async function gasGet<T>(params: Record<string, string>): Promise<T> {
  if (!SCRIPT_URL) throw new GasApiError('NEXT_PUBLIC_SCRIPT_URL is not configured');
  const query = new URLSearchParams(params).toString();
  const response = await fetchWithRetry(`${SCRIPT_URL}?${query}`);
  return response.json();
}
