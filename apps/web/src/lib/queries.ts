import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { TransactionsQuery } from '@uiab/contracts';
import { api } from './api';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 20_000,
  });
}

export function useOverview(month?: string) {
  return useQuery({
    queryKey: ['overview', month ?? 'latest'],
    queryFn: () => api.getOverview(month),
    refetchInterval: 60_000,
  });
}

export function useTransactions(query: Partial<TransactionsQuery>) {
  return useQuery({
    queryKey: ['transactions', query],
    queryFn: () => api.getTransactions(query),
    placeholderData: keepPreviousData,
  });
}

export function useMonths() {
  return useQuery({
    queryKey: ['months'],
    queryFn: api.getMonths,
  });
}
