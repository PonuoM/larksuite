type Envelope<T> = { ok: boolean; message: string; data: T };

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
  }
}

let csrf = '';
export function setCsrf(value: string) { csrf = value; }

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const response = await fetch(`/Workboard/api/v1${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json() as Envelope<T>;
  if (!response.ok) throw new ApiError(response.status, payload.message, payload.data);
  return payload.data;
}
