import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { PoolStatusCard } from '@/components/shared/PoolStatusCard';

interface PoolOverviewGridProps {
}

/**
 * Pool Overview Grid Component
 * Displays overview cards for all protocols dynamically
 */
export function PoolOverviewGrid({ }: PoolOverviewGridProps) {
  const { data: evmPool, isLoading: evmLoading, refetch: refetchEvm } = useQuery({
    queryKey: ['addressPool', 'evm'],
    queryFn: () => api.getAddressPoolAvailability('evm'),
    refetchInterval: 10000,
  });

  const { data: tronPool, isLoading: tronLoading, refetch: refetchTron } = useQuery({
    queryKey: ['addressPool', 'tron'],
    queryFn: () => api.getAddressPoolAvailability('tron'),
    refetchInterval: 10000,
  });

  const { data: solanaPool, isLoading: solanaLoading, refetch: refetchSolana } = useQuery({
    queryKey: ['addressPool', 'solana'],
    queryFn: () => api.getAddressPoolAvailability('solana'),
    refetchInterval: 10000,
  });

  const isLoading = evmLoading || tronLoading || solanaLoading;

  const handleRefresh = () => {
    refetchEvm();
    refetchTron();
    refetchSolana();
  };

  const handleImportSuccess = () => {
    // Refetch pool data after successful import
    handleRefresh();
  };

  // Build protocols array from available data
  const protocols = [];

  if (evmPool?.data) {
    protocols.push({
      protocol: 'evm',
      displayName: 'EVM',
      ...evmPool.data,
    });
  }

  if (tronPool?.data) {
    protocols.push({
      protocol: 'tron',
      displayName: 'Tron',
      ...tronPool.data,
    });
  }

  if (solanaPool?.data) {
    protocols.push({
      protocol: 'solana',
      displayName: 'Solana',
      ...solanaPool.data,
    });
  }

  const gridCols = protocols.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2';

  return (
    <div className="space-y-4">
      {/* Protocol Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <PoolOverviewSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
          {protocols.map((protocol) => (
            <PoolStatusCard
              key={protocol.protocol}
              protocol={protocol.protocol}
              displayName={protocol.displayName}
              total={protocol.total || 0}
              available={protocol.available || 0}
              allocated={protocol.allocated || 0}
              bound={protocol.bound || 0}
              coolingDown={protocol.coolingDown || 0}
              mode="detailed"
              onImportSuccess={handleImportSuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Pool Overview Skeleton
 * Loading skeleton for protocol pool cards
 */
function PoolOverviewSkeleton() {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-muted/50 p-2 space-y-2"
            >
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
