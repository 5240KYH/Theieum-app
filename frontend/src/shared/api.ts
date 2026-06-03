export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isJsonRequestBody(body: BodyInit | null | undefined) {
  return body
    && !(body instanceof FormData)
    && !(body instanceof Blob)
    && !(body instanceof URLSearchParams);
}

async function parseError(response: Response) {
  const text = await response.text();

  if (!text) {
    return `요청 처리 중 오류가 발생했습니다. (${response.status})`;
  }

  try {
    const data = JSON.parse(text) as { message?: string; error?: string };
    return data.message ?? data.error ?? text;
  } catch {
    return text;
  }
}

async function parseSuccess<T>(response: Response) {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    return undefined as T;
  }

  const text = await response.text();
  return text ? JSON.parse(text) as T : undefined as T;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && isJsonRequestBody(options.body)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new ApiError(await parseError(response), response.status);
  }

  return parseSuccess<T>(response);
}
