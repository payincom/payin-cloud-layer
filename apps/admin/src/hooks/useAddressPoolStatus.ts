import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AddressPoolProtocolSummary {
  protocol: 'evm' | 'tron' | 'solana';
  total: number;
  available: number;
  allocated: number;
  bound: number;
  coolingDown: number;
  error?: string;
}

export interface AddressPoolSummary {
  protocols: AddressPoolProtocolSummary[];
  totalAddresses: number;
  totalAvailable: number;
  hasAddresses: boolean;
  hasAvailableAddresses: boolean;
}

interface UseAddressPoolStatusOptions {
  refetchInterval?: number;
}

export function useAddressPoolStatus(options?: UseAddressPoolStatusOptions) {
  const queryResult = useQuery({
    queryKey: ['addressPool', 'summary'],
    queryFn: () => api.getAddressPoolSummary(),
    refetchInterval: options?.refetchInterval ?? 10000,
  });

  const summary = queryResult.data?.data as AddressPoolSummary | undefined;

  return {
    ...queryResult,
    summary,
    hasAnyAddresses: summary?.hasAddresses ?? false,
    hasAvailableAddresses: summary?.hasAvailableAddresses ?? false,
    totalAddresses: summary?.totalAddresses ?? 0,
    totalAvailable: summary?.totalAvailable ?? 0,
    protocols: summary?.protocols ?? [],
  };
}
