import type {
  Health,
  MonthsResponse,
  Overview,
  TransactionsQuery,
  TransactionsResponse,
} from '@uiab/contracts';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });

  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (
      payload as { error?: { code?: string; message?: string } } | null
    )?.error;

    throw new ApiError(
      response.status,
      error?.message ?? `Error ${response.status}`,
      error?.code,
    );
  }

  return payload as T;
}

function queryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }

  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

export const api = {
  getHealth: () => request<Health>('/health'),

  getMonths: () => request<MonthsResponse>('/v1/months'),

  getOverview: (month?: string) =>
    request<Overview>(`/v1/overview${queryString({ month })}`),

  getTransactions: (query: Partial<TransactionsQuery> = {}) =>
    request<TransactionsResponse>(
      `/v1/transactions${queryString({
        from: query.from,
        to: query.to,
        limit: query.limit,
        offset: query.offset,
      })}`,
    ),
};
