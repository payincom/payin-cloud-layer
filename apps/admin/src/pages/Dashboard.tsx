import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  ShoppingCart,
  Landmark,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  Percent,
  Wallet
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from '@/lib/time-utils';
import { PoolStatusCard } from '@/components/shared/PoolStatusCard';
import { RevenueCard } from '@/components/shared/RevenueCard';
import { AddressPoolSetupGuide } from '@/components/address-pool/AddressPoolSetupGuide';
import { useAddressPoolStatus } from '@/hooks/useAddressPoolStatus';

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  const {
    isLoading: poolSummaryLoading,
    isError: poolSummaryError,
    hasAnyAddresses,
  } = useAddressPoolStatus();

  const shouldLoadDashboardData =
    !poolSummaryLoading && (hasAnyAddresses || poolSummaryError);

  const getTimeRangeMs = () => {
    return timeRange === '24h' ? 24 * 60 * 60 * 1000 :
           timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
           30 * 24 * 60 * 60 * 1000;
  };

  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ['transfers', timeRange],
    queryFn: () => {
      const now = new Date();
      const detectedAfter = new Date(now.getTime() - getTimeRangeMs());
      return api.listTransfers({
        detectedAfter: detectedAfter.toISOString(),
        limit: '1000'
      });
    },
    refetchInterval: 10000,
    enabled: shouldLoadDashboardData,
  });

  const { data: chains, isLoading: chainsLoading } = useQuery({
    queryKey: ['chains'],
    queryFn: () => api.listChains(),
    refetchInterval: 10000,
    enabled: shouldLoadDashboardData,
  });

  const { data: orderStatsData, isLoading: orderStatsLoading } = useQuery({
    queryKey: ['orderStats', timeRange],
    queryFn: () => {
      const now = new Date();
      const createdAfter = new Date(now.getTime() - getTimeRangeMs());
      return api.getOrderStats({ createdAfter: createdAfter.toISOString() });
    },
    refetchInterval: 10000,
    enabled: shouldLoadDashboardData,
  });

  const { data: poolEvm, isLoading: poolEvmLoading } = useQuery({
    queryKey: ['addressPool', 'evm'],
    queryFn: () => api.getAddressPoolAvailability('evm'),
    refetchInterval: 10000,
    enabled: shouldLoadDashboardData,
  });

  const { data: poolTron, isLoading: poolTronLoading } = useQuery({
    queryKey: ['addressPool', 'tron'],
    queryFn: () => api.getAddressPoolAvailability('tron'),
    refetchInterval: 10000,
    enabled: shouldLoadDashboardData,
  });

  const { data: poolSolana } = useQuery({
    queryKey: ['addressPool', 'solana'],
    queryFn: () => api.getAddressPoolAvailability('solana'),
    refetchInterval: 10000,
    enabled: shouldLoadDashboardData,
  });


  // Get service switches configuration
  const { data: ordersEnabled } = useQuery({
    queryKey: ['config', 'services.orders_enabled'],
    queryFn: () => api.getSystemConfig('services.orders_enabled'),
    refetchInterval: 10000,
    enabled: shouldLoadDashboardData,
  });

  const { data: depositsEnabled } = useQuery({
    queryKey: ['config', 'services.deposits_enabled'],
    queryFn: () => api.getSystemConfig('services.deposits_enabled'),
    refetchInterval: 10000,
    enabled: shouldLoadDashboardData,
  });

  const isOrdersEnabled = ordersEnabled?.data?.value ?? true;
  const isDepositsEnabled = depositsEnabled?.data?.value ?? true;

  if (poolSummaryLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!poolSummaryLoading && !poolSummaryError && !hasAnyAddresses) {
    return (
      <div className="p-4 lg:p-8">
        <AddressPoolSetupGuide context="dashboard" />
      </div>
    );
  }

  const calculateRevenue = () => {
    if (!transfers?.data) return { total: {}, orders: {}, deposits: {} };

    const total: Record<string, number> = {};
    const orders: Record<string, number> = {};
    const deposits: Record<string, number> = {};

    // Server-side filtering already applied via detectedAfter parameter
    transfers.data.forEach((transfer: any) => {
      if (transfer.is_confirmed) {
        const token = transfer.token || 'USDC';
        const amount = parseFloat(transfer.amount || '0');

        total[token] = (total[token] || 0) + amount;

        if (transfer.business_type === 'order') {
          orders[token] = (orders[token] || 0) + amount;
        } else if (transfer.business_type === 'deposit') {
          deposits[token] = (deposits[token] || 0) + amount;
        }
      }
    });

    return { total, orders, deposits };
  };

  const calculateDepositCount = () => {
    if (!transfers?.data) return 0;
    // Server-side filtering already applied via detectedAfter parameter
    return transfers.data.filter((transfer: any) =>
      transfer.business_type === 'deposit' &&
      transfer.is_confirmed
    ).length;
  };

  const calculateOrderStats = () => {
    if (!orderStatsData?.data) return { total: 0, completed: 0, pending: 0, expired: 0, successRate: 0, avgPaymentTime: 0 };

    const stats = orderStatsData.data;
    const total = stats.totalOrders || 0;
    const completed = stats.completedOrders || 0;
    const pending = stats.pendingOrders || 0;
    const expired = stats.expiredOrders || 0;

    // Success rate = completed / (completed + expired)
    // Only count orders with final status (exclude pending)
    const finalizedOrders = completed + expired;
    const successRate = finalizedOrders > 0 ? Math.round((completed / finalizedOrders) * 100) : 0;

    // Convert from seconds to minutes
    const avgPaymentTime = (stats.avgPaymentTimeSeconds || 0) / 60;

    return {
      total,
      completed,
      pending,
      expired,
      successRate,
      avgPaymentTime
    };
  };

  const revenue = calculateRevenue();
  const orderStats = calculateOrderStats();
  const depositCount = calculateDepositCount();

  const calculateBoundAddressCount = () => {
    const evmBound = poolEvm?.data?.bound || 0;
    const tronBound = poolTron?.data?.bound || 0;
        return evmBound + tronBound;
  };

  const boundAddressCount = calculateBoundAddressCount();

  const poolCards = [
    poolEvm?.data && { protocol: 'evm', displayName: 'EVM', data: poolEvm.data },
    poolTron?.data && { protocol: 'tron', displayName: 'Tron', data: poolTron.data },
    poolSolana?.data && { protocol: 'solana', displayName: 'Solana', data: poolSolana.data },
  ].filter(Boolean) as Array<{ protocol: string; displayName: string; data: any }>;

  const poolLoading = poolEvmLoading || poolTronLoading;

  const poolGridCols =
    poolCards.length >= 3
      ? 'md:grid-cols-2 lg:grid-cols-3'
      : 'md:grid-cols-2';

  // Calculate alerts
  const getAlerts = () => {
    const alerts: Array<{ type: 'error' | 'warning'; message: string; icon: React.ReactNode }> = [];

    // Check address pool availability
    const checkPool = (pool: any, protocol: string) => {
      if (pool?.data) {
        const available = pool.data.available || 0;
        const total = pool.data.total || 0;
        const availableRate = total > 0 ? (available / total) * 100 : 0;

        if (availableRate < 10 && total > 0) {
          alerts.push({
            type: 'error',
            message: `Critical: ${protocol.toUpperCase()} address pool nearly empty (${available}/${total} available)`,
            icon: <Wallet className="w-4 h-4" />
          });
        } else if (availableRate < 20 && total > 0) {
          alerts.push({
            type: 'warning',
            message: `${protocol.toUpperCase()} address pool running low (${available}/${total} available)`,
            icon: <Wallet className="w-4 h-4" />
          });
        }
      }
    };

    checkPool(poolEvm, 'EVM');
    checkPool(poolTron, 'Tron');
    checkPool(poolSolana, 'Solana');

    // Check pending vs completed
    if (orderStats.pending > orderStats.completed && orderStats.total > 5) {
      alerts.push({
        type: 'warning',
        message: `More pending orders (${orderStats.pending}) than completed (${orderStats.completed})`,
        icon: <Clock className="w-4 h-4" />
      });
    }

    // Check chain health
    const unhealthyChains = chains?.data?.filter((chain: any) =>
      chain.syncStatus && !chain.syncStatus.isHealthy
    ) || [];
    if (unhealthyChains.length > 0) {
      alerts.push({
        type: 'error',
        message: `${unhealthyChains.length} blockchain${unhealthyChains.length > 1 ? 's' : ''} unhealthy: ${unhealthyChains.map((c: any) => c.name).join(', ')}`,
        icon: <Activity className="w-4 h-4" />
      });
    }

    return alerts;
  };

  const alerts = getAlerts();

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-end">
        <div className="flex gap-2">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {range === '24h' ? '24h' : range === '7d' ? '7d' : '30d'}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Section */}
      {!transfersLoading && !orderStatsLoading && !chainsLoading && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <Card
              key={index}
              className={`p-4 border-l-4 ${
                alert.type === 'error'
                  ? 'border-l-red-500 bg-red-500/10'
                  : 'border-l-yellow-500 bg-yellow-500/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={alert.type === 'error' ? 'text-red-500' : 'text-yellow-500'}>
                  {alert.icon}
                </div>
                <p className={`text-sm font-medium ${
                  alert.type === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {alert.message}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Order Business Section */}
      <div className="space-y-4">
        <Link to="/orders" className="flex items-center gap-3 hover:opacity-80 transition-opacity w-fit">
          <ShoppingCart className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-bold text-foreground">Orders</h2>
          {!isOrdersEnabled && (
            <Badge variant="destructive" className="gap-1.5">
              <XCircle className="w-3 h-3" />
              Disabled
            </Badge>
          )}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Card - Takes more space */}
          {transfersLoading ? (
            <RevenueCardSkeleton />
          ) : (
            <RevenueCard
              title="Order Revenue"
              amounts={revenue.orders}
              icon={<DollarSign className="w-5 h-5" />}
            />
          )}

          {/* Stats Grid - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {orderStatsLoading ? (
                <>
                  <StatsCardSkeleton />
                  <StatsCardSkeleton />
                  <StatsCardSkeleton />
                  <StatsCardSkeleton />
                  <StatsCardSkeleton />
                  <StatsCardSkeleton />
                </>
              ) : (
                <>
                  <StatsCard
                    label="Total Orders"
                    value={orderStats.total}
                    icon={<ShoppingCart className="w-4 h-4" />}
                  />
                  <StatsCard
                    label="Avg Pay Time"
                    value={orderStats.avgPaymentTime < 1
                      ? `${Math.round(orderStats.avgPaymentTime * 60)}s`
                      : `${orderStats.avgPaymentTime.toFixed(1)}m`}
                    icon={<Clock className="w-4 h-4" />}
                  />
                  <StatsCard
                    label="Success Rate"
                    value={`${orderStats.successRate}%`}
                    icon={<Percent className="w-4 h-4" />}
                    variant={orderStats.successRate >= 90 ? "success" : orderStats.successRate >= 70 ? "warning" : "danger"}
                  />
                  <StatsCard
                    label="Completed"
                    value={orderStats.completed}
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    variant="success"
                  />
                  <StatsCard
                    label="Pending"
                    value={orderStats.pending}
                    icon={<Clock className="w-4 h-4" />}
                    variant="warning"
                  />
                  <StatsCard
                    label="Expired"
                    value={orderStats.expired}
                    icon={<XCircle className="w-4 h-4" />}
                    variant="danger"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Business Section */}
      <div className="space-y-4">
        <Link to="/deposits" className="flex items-center gap-3 hover:opacity-80 transition-opacity w-fit">
          <Landmark className="w-6 h-6 text-purple-500" />
          <h2 className="text-xl font-bold text-foreground">Deposits</h2>
          {!isDepositsEnabled && (
            <Badge variant="destructive" className="gap-1.5">
              <XCircle className="w-3 h-3" />
              Disabled
            </Badge>
          )}
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {transfersLoading ? (
            <>
              <RevenueCardSkeleton />
              <StatsCardSkeleton />
              <StatsCardSkeleton />
            </>
          ) : (
            <>
              <RevenueCard
                title="Deposit Amount"
                amounts={revenue.deposits}
                icon={<DollarSign className="w-5 h-5" />}
              />
              <LargeStatsCard
                label="Total Deposits"
                value={depositCount}
                icon={<Landmark className="w-5 h-5" />}
              />
              <LargeStatsCard
                label="Bound Addresses"
                value={boundAddressCount}
                icon={<Wallet className="w-5 h-5" />}
              />
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Address Pool Status - Moved up for priority */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          Address Pool Status
        </h2>
        {poolLoading ? (
          <div className={`grid grid-cols-1 ${poolGridCols} gap-6`}>
            {Array.from({ length: poolCards.length > 0 ? poolCards.length : 3 }).map((_, index) => (
              <PoolStatusSkeleton key={index} />
            ))}
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${poolGridCols} gap-6`}>
            {poolCards.map((pool) => (
              <PoolStatusCard
                key={pool.protocol}
                protocol={pool.protocol}
                displayName={pool.displayName}
                total={pool.data.total || 0}
                available={pool.data.available || 0}
                allocated={pool.data.allocated || 0}
                bound={pool.data.bound || 0}
                coolingDown={pool.data.coolingDown || 0}
                mode="compact"
              />
            ))}
          </div>
        )}
      </div>

      {/* Chain Status */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Blockchain Status
        </h2>
        {chainsLoading ? (
          <ChainStatusGridSkeleton />
        ) : chains?.data ? (
          <ChainStatusGrid chains={chains.data} />
        ) : null}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentOrdersCard />
        <RecentDepositsCard />
      </div>
    </div>
  );
}

function StatsCard({
  label,
  value,
  icon,
  variant = 'default'
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colors = {
    default: 'text-primary',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    danger: 'text-red-500'
  };

  return (
    <Card className="p-4 border-border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <span className={`text-2xl font-bold ${colors[variant]}`}>{value}</span>
      </div>
    </Card>
  );
}

function LargeStatsCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-6 border-border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground mb-4">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
    </Card>
  );
}


function ChainStatusGrid({ chains }: { chains: any[] }) {
  const monitoredChains = chains.filter(chain => chain.syncStatus);

  if (monitoredChains.length === 0) {
    return (
      <Card className="p-12 text-center border-border bg-card">
        <Activity className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-muted-foreground">No chains are currently being monitored</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {monitoredChains.map((chain: any) => (
        <Card key={chain.chainId} className="p-6 border-border bg-card hover:bg-accent/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">{chain.name}</h3>
              <p className="text-xs text-muted-foreground font-mono mt-1">{chain.chainId}</p>
            </div>
            <Badge variant={chain.syncStatus?.isHealthy ? "default" : "destructive"}>
              {chain.syncStatus?.isHealthy ? 'Healthy' : 'Unhealthy'}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Latest Block</span>
              <span className="font-mono font-semibold text-primary">
                #{chain.syncStatus?.latestProcessedBlock}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline" className="text-xs">
                {chain.syncStatus?.syncStatus}
              </Badge>
            </div>
            {chain.syncStatus?.behindBlocks > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Behind</span>
                <span className="font-semibold text-yellow-500">
                  {chain.syncStatus.behindBlocks} blocks
                </span>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

/**
 * Pending Orders Card - Shows latest 10 pending orders
 */
function RecentOrdersCard() {
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['pendingOrders'],
    queryFn: () => api.listOrders({ limit: '100' }),
    refetchInterval: 10000,
  });

  // Filter for pending orders only and limit to 10
  const pendingOrders = (ordersData?.data || [])
    .filter((order: any) => order.status === 'pending')
    .slice(0, 10);

  return (
    <Card className="border-border bg-card">
      <div className="p-6 pb-4 border-b border-border">
        <Link to="/orders" className="group flex items-center justify-between hover:opacity-80 transition-opacity">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Pending Orders
            </h3>
            {!isLoading && pendingOrders.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingOrders.length}
              </Badge>
            )}
          </div>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      </div>

      {isLoading ? (
        <div className="p-6 text-center text-muted-foreground">Loading...</div>
      ) : pendingOrders.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
          <p className="text-muted-foreground text-sm">✓ No pending orders</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs">
                <th className="text-left p-3 font-medium text-muted-foreground">Order ID</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Chain</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map((order: any) => (
                <tr
                  key={order.id}
                  onClick={() => window.location.href = '/orders'}
                  className="border-b border-border hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <td className="p-3">
                    <div className="font-mono text-xs text-foreground truncate max-w-[150px]">
                      {order.id}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-foreground">{order.amount}</span>
                      <span className="text-xs text-muted-foreground">{order.token}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="secondary" className="text-xs">{order.chain}</Badge>
                  </td>
                  <td className="p-3">
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(order.created_at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/**
 * Confirming Deposits Card - Shows latest 10 unconfirmed deposits
 */
function RecentDepositsCard() {
  const { data: transfersData, isLoading } = useQuery({
    queryKey: ['confirmingDeposits'],
    queryFn: () => api.listTransfers({ businessType: 'deposit', limit: '100' }),
    refetchInterval: 10000,
  });

  // Filter for unconfirmed deposits only and limit to 10
  const confirmingDeposits = (transfersData?.data || [])
    .filter((transfer: any) => !transfer.is_confirmed)
    .slice(0, 10);

  return (
    <Card className="border-border bg-card">
      <div className="p-6 pb-4 border-b border-border">
        <Link to="/deposits" className="group flex items-center justify-between hover:opacity-80 transition-opacity">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-yellow-500" />
              Confirming Deposits
            </h3>
            {!isLoading && confirmingDeposits.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {confirmingDeposits.length}
              </Badge>
            )}
          </div>
          <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>
      </div>

      {isLoading ? (
        <div className="p-6 text-center text-muted-foreground">Loading...</div>
      ) : confirmingDeposits.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
          <p className="text-muted-foreground text-sm">✓ No deposits confirming</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs">
                <th className="text-left p-3 font-medium text-muted-foreground">User</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Chain</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {confirmingDeposits.map((transfer: any, idx: number) => (
                <tr
                  key={idx}
                  onClick={() => window.location.href = '/deposits'}
                  className="border-b border-border hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <td className="p-3">
                    <div className="text-sm text-foreground truncate max-w-[150px]">
                      {transfer.deposit_reference}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-foreground">
                        {parseFloat(transfer.amount || '0').toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground">{transfer.token}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant="secondary" className="text-xs">{transfer.chain}</Badge>
                  </td>
                  <td className="p-3">
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(transfer.detected_at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// Skeleton Components
function RevenueCardSkeleton() {
  return (
    <Card className="p-6 border-border bg-card">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
    </Card>
  );
}

function StatsCardSkeleton() {
  return (
    <Card className="p-6 border-border bg-card">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-8 w-16" />
    </Card>
  );
}

function ChainStatusGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="p-4 border-border bg-card">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function PoolStatusSkeleton() {
  return (
    <Card className="border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="flex items-center justify-between text-sm">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex items-center gap-1">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-2 w-12" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
