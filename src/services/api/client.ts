import { API_BASE_URL, API_KEY, API_VERSION } from '@/shared/constants';

let _apiKey = API_KEY;

export function setApiKey(key: string) {
  _apiKey = key;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('hexbandit_api_key', key);
  }
}

export function getApiKey(): string {
  if (_apiKey) return _apiKey;
  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('hexbandit_api_key') || '';
  }
  return '';
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const key = getApiKey();
  if (key) headers['X-API-Key'] = key;
  return headers;
}

export class ApiError extends Error {
  status: number;
  detail?: unknown;
  path: string;

  constructor(message: string, status: number, path: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
    this.detail = detail;
  }

  get isAuth() {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConflict() {
    return this.status === 409;
  }
}

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const url = `${API_BASE_URL}${API_VERSION}${path}`;
  const opts: RequestInit = {
    method,
    headers: buildHeaders(),
  };
  if (signal) opts.signal = signal;
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    let message = `HTTP ${res.status}`;
    let detail: unknown;

    if (contentType.includes('application/json')) {
      const err = await res.json().catch(() => null);
      if (err) {
        detail = err.detail;
        message = typeof err.detail === 'string'
          ? err.detail
          : typeof err.detail === 'object' && err.detail !== null
            ? (err.detail as Record<string, unknown>).message as string || JSON.stringify(err.detail)
            : JSON.stringify(err);
      }
    } else {
      if (res.status === 502) message = 'Server unavailable (502)';
      else if (res.status === 503) message = 'Server starting (503)';
      else if (res.status === 504) message = 'Gateway timeout (504)';
      else message = res.statusText || message;
    }

    throw new ApiError(message, res.status, path, detail);
  }

  return res.json() as Promise<T>;
}

export async function apiDelete(path: string, signal?: AbortSignal): Promise<void> {
  const url = `${API_BASE_URL}${API_VERSION}${path}`;
  const key = getApiKey();
  const headers: Record<string, string> = {};
  if (key) headers['X-API-Key'] = key;
  await fetch(url, { method: 'DELETE', headers, signal });
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) =>
    apiRequest<T>('GET', path, undefined, signal),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiRequest<T>('POST', path, body, signal),
  delete: (path: string, signal?: AbortSignal) =>
    apiDelete(path, signal),
};
