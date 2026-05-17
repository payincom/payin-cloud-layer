import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { formatRelativeTime, getExplorerUrl, getAddressExplorerUrl } from '@/lib/time-utils';
import {
  ShoppingCart,
  Eye,
  ChevronLeft,
  ChevronRight,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Settings,
  DollarSign,
  TrendingUp,
  Activity,
  AlertTriangle,
  ExternalLink,
  Download,
  Search,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineRevenueCard } from '@/components/shared/InlineRevenueCard';
import { TimeRangeSelector, getStartDateFromTimeRange } from '@/components/shared/TimeRangeSelector';
import { useGlobalTimeRange } from '@/hooks/useGlobalTimeRange';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressPoolSetupGuide } from '@/components/address-pool/AddressPoolSetupGuide';
import { useAddressPoolStatus } from '@/hooks/useAddressPoolStatus';
import { EmptyState } from '@/components/shared/EmptyState';

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [timeRange, setTimeRange] = useGlobalTimeRange();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const limit = 20;

  const queryClient = useQueryClient();

  const {
    isLoading: poolSummaryLoading,
    isError: poolSummaryError,
    hasAnyAddresses,
  } = useAddressPoolStatus();

  const shouldFetchOrders = !poolSummaryLoading && (poolSummaryError || hasAnyAddresses);

  // Check if order service is enabled
  const { data: serviceConfig } = useQuery({
    queryKey: ['config', 'services.orders_enabled'],
    queryFn: () => api.getSystemConfig('services.orders_enabled'),
    refetchInterval: 5000,
    enabled: shouldFetchOrders,
  });

  const isServiceEnabled = serviceConfig?.data?.value ?? true;

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', page, status, timeRange],
    queryFn: () => {
      const startDate = getStartDateFromTimeRange(timeRange);
      return api.listOrders({
        page: page.toString(),
        limit: '100',
        ...(status && status !== 'all' && { status }),
        ...(startDate && { createdAfter: startDate.toISOString() }),
      });
    },
    refetchInterval: 5000,
    enabled: shouldFetchOrders,
  });

  const { data: statsData } = useQuery({
    queryKey: ['orderStats', timeRange],
    queryFn: () => {
      const startDate = getStartDateFromTimeRange(timeRange);
      return api.getOrderStats({
        ...(startDate && { createdAfter: startDate.toISOString() })
      });
    },
    refetchInterval: 10000,
    enabled: shouldFetchOrders,
  });

  const allOrders = data?.data || [];
  const stats = statsData?.data || {};

  // Handle URL parameter to auto-open order detail
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId && allOrders.length > 0) {
      const order = allOrders.find((o: any) => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
        // Remove the parameter after opening
        searchParams.delete('orderId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, allOrders, setSearchParams]);

  const todayRevenue = useMemo(() => {
    const revenue: Record<string, number> = {};
    const startDate = getStartDateFromTimeRange(timeRange);

    allOrders
      .filter((order: any) => {
        if (order.status !== 'completed' || !order.completed_at) return false;
        if (!startDate) return true; // 'all' - include all completed orders
        return new Date(order.completed_at) >= startDate;
      })
      .forEach((order: any) => {
        const token = order.token || 'USDC';
        revenue[token] = (revenue[token] || 0) + parseFloat(order.amount || '0');
      });

    return revenue;
  }, [allOrders, timeRange]);

  const alerts = useMemo(() => {
    const result = [];
    const now = Date.now();

    const longPending = allOrders.filter((order: any) => {
      if (order.status !== 'pending') return false;
      const age = now - new Date(order.created_at).getTime();
      return age > 8 * 60 * 1000;
    });

    if (longPending.length > 0) {
      result.push({
        type: 'warning' as const,
        icon: <Clock className="w-4 h-4" />,
        message: `${longPending.length} order${longPending.length > 1 ? 's' : ''} pending for over 8 minutes`,
        action: () => setStatus('pending'),
      });
    }

    const recentlyCompleted = allOrders.filter((order: any) => {
      if (order.status !== 'completed' || !order.completed_at) return false;
      const age = now - new Date(order.completed_at).getTime();
      return age < 60 * 1000;
    });

    if (recentlyCompleted.length > 0) {
      result.push({
        type: 'success' as const,
        icon: <CheckCircle2 className="w-4 h-4" />,
        message: `${recentlyCompleted.length} order${recentlyCompleted.length > 1 ? 's' : ''} just completed`,
        action: () => setStatus('completed'),
      });
    }

    const recentlyExpired = allOrders.filter((order: any) => {
      if (order.status !== 'expired') return false;
      const expiryAge = now - new Date(order.expires_at || order.created_at).getTime();
      return expiryAge < 60 * 60 * 1000;
    });

    if (recentlyExpired.length > 0) {
      result.push({
        type: 'error' as const,
        icon: <XCircle className="w-4 h-4" />,
        message: `${recentlyExpired.length} order${recentlyExpired.length > 1 ? 's' : ''} expired in the last hour`,
        action: () => setStatus('expired'),
      });
    }

    return result;
  }, [allOrders]);

  const displayOrders = useMemo(() => {
    let filtered = allOrders;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((order: any) =>
        order.id.toLowerCase().includes(query) ||
        order.order_reference?.toLowerCase().includes(query) ||
        order.address?.toLowerCase().includes(query)
      );
    }

    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [allOrders, searchQuery, page, limit]);

  const todayStats = {
    total: stats.totalOrders || 0,
    completed: stats.completedOrders || 0,
    pending: stats.pendingOrders || 0,
    expired: stats.expiredOrders || 0,
    successRate: stats.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0,
    avgPaymentTime: stats.avgPaymentTimeSeconds ? (stats.avgPaymentTimeSeconds / 60) : 0,
  };

  const oldestPendingTime = useMemo(() => {
    const pending = allOrders.filter((o: any) => o.status === 'pending');
    if (pending.length === 0) return null;
    const oldest = pending.reduce((oldest: any, current: any) =>
      new Date(current.created_at) < new Date(oldest.created_at) ? current : oldest
    );
    return formatRelativeTime(oldest.created_at);
  }, [allOrders]);

  if (poolSummaryLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!poolSummaryLoading && !poolSummaryError && !hasAnyAddresses) {
    return (
      <div className="p-4 lg:p-8">
        <AddressPoolSetupGuide context="orders" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Page Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage payment orders
            {timeRange !== 'all' && ` • Last ${timeRange}`}
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {!isServiceEnabled && (
        <Card className="border-l-4 border-l-red-500 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-600 dark:text-red-400 mb-1">
                  Order Service is Disabled
                </h3>
                <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-3">
                  New order creation requests will be rejected, but existing orders will continue to process payments normally.
                </p>
                <Link to="/config">
                  <Button variant="outline" size="sm" className="gap-2 border-red-500 text-red-500 hover:bg-red-500/10">
                    <Settings className="w-4 h-4" />
                    Go to Config to Enable
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Needs Attention
          </h2>
          {alerts.map((alert, index) => (
            <Card
              key={index}
              className={`border-l-4 cursor-pointer hover:bg-accent/50 transition-colors ${
                alert.type === 'error'
                  ? 'border-l-red-500 bg-red-500/10'
                  : alert.type === 'warning'
                  ? 'border-l-yellow-500 bg-yellow-500/10'
                  : 'border-l-green-500 bg-green-500/10'
              }`}
              onClick={alert.action}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={
                      alert.type === 'error'
                        ? 'text-red-500'
                        : alert.type === 'warning'
                        ? 'text-yellow-500'
                        : 'text-green-500'
                    }>
                      {alert.icon}
                    </div>
                    <p className={`text-sm font-medium ${
                      alert.type === 'error'
                        ? 'text-red-600 dark:text-red-400'
                        : alert.type === 'warning'
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {alert.message}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">Click to filter →</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InlineRevenueCard
            title="Revenue"
            amounts={todayRevenue}
            icon={<DollarSign className="w-4 h-4" />}
          />

          <Card className="md:col-span-2">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Success Rate</div>
                  <div className={`text-2xl font-bold ${
                    todayStats.successRate >= 90 ? 'text-green-500' :
                    todayStats.successRate >= 70 ? 'text-yellow-500' :
                    'text-red-500'
                  }`}>
                    {todayStats.successRate}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Avg Pay Time</div>
                  <div className="text-2xl font-bold text-foreground">
                    {todayStats.avgPaymentTime < 1
                      ? `${Math.round(todayStats.avgPaymentTime * 60)}s`
                      : `${todayStats.avgPaymentTime.toFixed(1)}m`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Pending</div>
                  <div className="text-2xl font-bold text-yellow-500">{todayStats.pending}</div>
                  {todayStats.pending > 0 && oldestPendingTime && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Oldest: {oldestPendingTime}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Completed / Total</div>
                  <div className="text-2xl font-bold text-green-500">
                    {todayStats.completed} / {todayStats.total}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <CardTitle>Order List</CardTitle>
              <CardDescription>
                {allOrders.length} {allOrders.length === 1 ? 'order' : 'orders'}
                {timeRange !== 'all' && ` in last ${timeRange}`}
                {status !== 'all' && ` • Filtered by ${status}`}
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              disabled={!isServiceEnabled}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Create
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Order ID, Reference, Address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['orders'] })}
              disabled={isLoading}
              title="Refresh list"
              aria-label="Refresh list"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          {isLoading ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <OrdersTableSkeleton />
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <XCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
              <p className="text-destructive">Error loading orders</p>
            </div>
          ) : displayOrders.length === 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <EmptyState
                icon={ShoppingCart}
                title={searchQuery ? 'No orders found' : 'No orders yet'}
                description={
                  searchQuery
                    ? 'Try adjusting your search or filters to find the order you need.'
                    : 'Create your first order to test the payment flow end-to-end.'
                }
                action={
                  searchQuery
                    ? undefined
                    : (
                      <Button onClick={() => setShowCreateModal(true)} disabled={!isServiceEnabled}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create order
                      </Button>
                    )
                }
                helpHref="https://docs.payin.com/en/guide/order-payment.html"
                helpLabel="View orders guide"
                className="py-16"
              />
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <OrdersTable orders={displayOrders} onSelectOrder={setSelectedOrder} />
              </div>

              {allOrders.length > limit && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{(page - 1) * limit + 1}</span> to{' '}
                    <span className="font-medium text-foreground">{Math.min(page * limit, allOrders.length)}</span> of{' '}
                    <span className="font-medium text-foreground">{allOrders.length}</span> results
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page * limit >= allOrders.length}
                      className="gap-2"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          }}
        />
      )}
    </div>
  );
}

function OrdersTable({ orders, onSelectOrder }: any) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Order ID / Reference</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Received</TableHead>
          <TableHead>Chain</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Link</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order: any) => (
          <OrderRow key={order.id} order={order} onSelect={onSelectOrder} />
        ))}
      </TableBody>
    </Table>
  );
}

function OrderRow({ order, onSelect }: any) {
  const { data: transfersData } = useQuery({
    queryKey: ['transfers', order.id],
    queryFn: () => api.getTransfersByReference({ orderId: order.id }),
  });

  const transfers = transfersData?.data || [];

  const confirmedTransfers = transfers.filter((t: any) => t.is_confirmed);
  const pendingTransfers = transfers.filter((t: any) => !t.is_confirmed);

  const receivedAmount = confirmedTransfers
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);

  const pendingAmount = pendingTransfers
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);

  const targetAmount = parseFloat(order.amount || '0');
  const percentage = targetAmount > 0 ? Math.round((receivedAmount / targetAmount) * 100) : 0;
  const pendingPercentage = targetAmount > 0 ? Math.round((pendingAmount / targetAmount) * 100) : 0;
  const transferCount = transfers.length;
  const hasPendingTransfers = pendingTransfers.length > 0;

  return (
    <TableRow className="hover:bg-accent/50 cursor-pointer" onClick={() => onSelect(order)}>
      <TableCell>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          {hasPendingTransfers && order.status === 'pending' && (
            <Badge variant="outline" className="gap-1 text-xs text-blue-500 border-blue-500/30 bg-blue-500/10">
              <Clock className="w-3 h-3 animate-pulse" />
              Confirming
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="font-mono text-sm text-foreground">{order.id}</div>
          {order.order_reference && (
            <div className="text-xs text-muted-foreground">
              ({order.order_reference})
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{order.amount}</span>
          <Badge variant="outline" className="text-xs">{order.token}</Badge>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-foreground">
              ${receivedAmount.toFixed(2)}
            </div>
            {hasPendingTransfers && (
              <div className="text-xs text-blue-500">
                +${pendingAmount.toFixed(2)} pending
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-xs font-medium ${
              percentage >= 100 ? 'text-green-500' :
              percentage >= 50 ? 'text-yellow-500' :
              'text-muted-foreground'
            }`}>
              {percentage}% {percentage >= 100 && '✓'}
            </div>
            {hasPendingTransfers && pendingPercentage > 0 && (
              <div className="text-xs text-blue-500">
                ({pendingPercentage}% confirming)
              </div>
            )}
          </div>
          {transferCount > 0 && (
            <div className="text-xs text-muted-foreground">
              {confirmedTransfers.length} confirmed
              {hasPendingTransfers && `, ${pendingTransfers.length} pending`}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{order.chain}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatRelativeTime(order.created_at)}
      </TableCell>
      <TableCell>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={(e) => {
            e.stopPropagation();
            const serverBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/api\/v1$/, '');
            window.open(`${serverBaseUrl}/pay/order/${order.id}`, '_blank');
          }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Link
        </Button>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
        >
          <Eye className="w-4 h-4" />
          Details
        </Button>
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { icon: Clock, label: 'Pending', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
    completed: { icon: CheckCircle2, label: 'Completed', color: 'bg-green-500/20 text-green-700 dark:text-green-400' },
    expired: { icon: XCircle, label: 'Expired', color: '' },
  };

  const { icon: Icon, label, color } = config[status as keyof typeof config] || config.pending;

  return (
    <Badge className={`gap-1.5 ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

function OrderDetailModal({ order, onClose }: { order: any; onClose: () => void }) {
  const { data: transfersData } = useQuery({
    queryKey: ['transfers', order.id],
    queryFn: () => api.getTransfersByReference({ orderId: order.id }),
  });

  const transfers = transfersData?.data || [];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">Order Details - {order.id}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-4 flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transfers">
              Transfers {transfers.length > 0 && `(${transfers.length})`}
            </TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-6">
            <TabsContent value="overview" className="space-y-6 m-0">
              <OverviewTab order={order} transfers={transfers} copyToClipboard={copyToClipboard} />
            </TabsContent>

            <TabsContent value="transfers" className="space-y-6 m-0">
              <TransfersTab order={order} transfers={transfers} copyToClipboard={copyToClipboard} />
            </TabsContent>

            <TabsContent value="timeline" className="space-y-6 m-0">
              <TimelineTab order={order} transfers={transfers} />
            </TabsContent>

            <TabsContent value="actions" className="space-y-6 m-0">
              <ActionsTab order={order} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function OverviewTab({ order, transfers, copyToClipboard }: any) {
  const receivedAmount = transfers
    .filter((t: any) => t.is_confirmed)
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);

  const targetAmount = parseFloat(order.amount || '0');
  const percentage = targetAmount > 0 ? Math.round((receivedAmount / targetAmount) * 100) : 0;
  const remaining = Math.max(0, targetAmount - receivedAmount);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          Order Information
        </h3>
        <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order ID:</span>
            <span className="font-mono font-medium text-foreground">{order.id}</span>
          </div>
          {order.order_reference && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">External Reference:</span>
              <span className="font-mono text-foreground">{order.order_reference}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target Amount:</span>
            <span className="font-medium text-foreground">{order.amount} {order.token}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span className="text-foreground">{format(new Date(order.created_at), 'PPp')}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Payment Address
        </h3>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-background rounded text-sm font-mono text-foreground break-all border border-border">
            {order.address}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(order.address, 'Address')}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Payment Progress
        </h3>
        <div className="bg-muted rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Received:</span>
            <span className="font-medium text-foreground">${receivedAmount.toFixed(2)} {order.token} ({percentage}%)</span>
          </div>
          {percentage < 100 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-medium text-yellow-600 dark:text-yellow-400">${remaining.toFixed(2)} {order.token}</span>
            </div>
          )}
          {percentage > 100 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overpaid:</span>
              <span className="font-medium text-green-600 dark:text-green-400">+${(receivedAmount - targetAmount).toFixed(2)} {order.token}</span>
            </div>
          )}
          <div className="w-full bg-muted-foreground/20 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all ${percentage >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TransfersTab({ order, transfers, copyToClipboard }: any) {
  const targetAmount = parseFloat(order.amount || '0');
  const confirmedTransfers = transfers.filter((t: any) => t.is_confirmed);

  let runningTotal = 0;

  const receivedAmount = confirmedTransfers.reduce((sum: number, t: any) => sum + parseFloat(t.amount || '0'), 0);
  const percentage = targetAmount > 0 ? Math.round((receivedAmount / targetAmount) * 100) : 0;
  const remaining = Math.max(0, targetAmount - receivedAmount);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Payment Progress Summary</h3>
        <div className="bg-muted rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Target:</span>
            <span className="font-medium text-foreground">{targetAmount.toFixed(2)} {order.token}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Received:</span>
            <span className="font-medium text-foreground">{receivedAmount.toFixed(2)} {order.token} ({percentage}%)</span>
          </div>
          {percentage < 100 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-medium text-yellow-600 dark:text-yellow-400">{remaining.toFixed(2)} {order.token}</span>
            </div>
          )}
          {percentage >= 100 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Payment Complete
              </span>
            </div>
          )}
          <div className="w-full bg-muted-foreground/20 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all ${percentage >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Transfer History ({transfers.length} transfer{transfers.length !== 1 ? 's' : ''})
        </h3>

        {transfers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No transfers detected yet</p>
            <p className="text-sm mt-1">Waiting for customer payment...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transfers.map((transfer: any, idx: number) => {
              const amount = parseFloat(transfer.amount || '0');
              if (transfer.is_confirmed) {
                runningTotal += amount;
              }
              const runningPercentage = targetAmount > 0 ? Math.round((runningTotal / targetAmount) * 100) : 0;

              return (
                <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {transfer.is_confirmed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0 animate-pulse" />
                      )}
                      <div>
                        <h4 className="font-semibold text-foreground">
                          Transfer #{idx + 1} - {transfer.is_confirmed ? 'Confirmed' : 'Pending Confirmation'}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Detected: {format(new Date(transfer.detected_at), 'PPp')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Amount:</span>
                      <p className="font-semibold text-foreground mt-1">{amount.toFixed(2)} {transfer.token}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Chain:</span>
                      <Badge variant="secondary" className="mt-1">{transfer.chain}</Badge>
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-sm">From Address:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 px-2 py-1 bg-background rounded text-xs font-mono text-foreground break-all border border-border">
                        {transfer.from_address}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(transfer.from_address, 'Address')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(getAddressExplorerUrl(transfer.chain, transfer.from_address), '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-sm">TX Hash:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 px-2 py-1 bg-background rounded text-xs font-mono text-foreground break-all border border-border">
                        {transfer.transaction_hash}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(transfer.transaction_hash, 'TX Hash')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(getExplorerUrl(transfer.chain, transfer.transaction_hash), '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {transfer.is_confirmed && (
                    <div className="pt-3 border-t border-border">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">Running Total:</span>
                        <span className="font-semibold text-foreground">
                          {runningTotal.toFixed(2)} {order.token} ({runningPercentage}% of target)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {percentage < 100 && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Still waiting for {remaining.toFixed(2)} {order.token} to complete this order
            </p>
          </div>
        )}

        {percentage >= 100 && percentage <= 100 && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Payment complete! Order target amount reached.
            </p>
          </div>
        )}

        {percentage > 100 && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300 flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Order completed! Customer overpaid by {(receivedAmount - targetAmount).toFixed(2)} {order.token}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineTab({ order, transfers }: any) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Timeline
      </h3>
      <div className="space-y-3 pl-6 border-l-2 border-border">
        <TimelineItem
          label="Order Created"
          time={order.created_at}
          status="completed"
        />
        {transfers.filter((t: any) => t.is_confirmed).map((transfer: any, idx: number) => (
          <TimelineItem
            key={idx}
            label={`Payment Detected (Transfer #${idx + 1})`}
            time={transfer.detected_at}
            status="completed"
            subtitle={`${transfer.amount} ${transfer.token}`}
          />
        ))}
        {order.status === 'completed' && order.completed_at && (
          <TimelineItem
            label="Order Completed"
            time={order.completed_at}
            status="completed"
          />
        )}
        {order.status === 'pending' && (
          <TimelineItem
            label="Waiting for Payment"
            time=""
            status="pending"
            subtitle={`Expires: ${format(new Date(order.expires_at || order.created_at), 'PPp')}`}
          />
        )}
        {order.status === 'expired' && (
          <TimelineItem
            label="Order Expired"
            time={order.expires_at || order.created_at}
            status="expired"
          />
        )}
      </div>
    </div>
  );
}

function TimelineItem({ label, time, status, subtitle }: { label: string; time: string; status: 'completed' | 'pending' | 'expired'; subtitle?: string }) {
  const colors = {
    completed: 'bg-green-500',
    pending: 'bg-yellow-500 animate-pulse',
    expired: 'bg-red-500',
  };

  const textColors = {
    completed: 'text-foreground',
    pending: 'text-yellow-600 dark:text-yellow-400',
    expired: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="relative">
      <div className={`absolute -left-[1.6rem] top-1 w-3 h-3 rounded-full ${colors[status]}`} />
      <div className="text-sm">
        <div className={`font-medium ${textColors[status]}`}>{label}</div>
        {time && (
          <div className="text-muted-foreground">
            {format(new Date(time), 'PPp')}
          </div>
        )}
        {subtitle && (
          <div className="text-muted-foreground text-xs mt-1">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

function ActionsTab({ order: _order }: any) {
  void _order;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Export & Share</h3>
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start">
            <Download className="w-4 h-4 mr-2" />
            Export Order Proof
          </Button>
          <Button variant="outline" className="w-full justify-start">
            <Copy className="w-4 h-4 mr-2" />
            Copy Payment Info
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateOrderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [orderReference, setOrderReference] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('USDC');
  const [chain, setChain] = useState('');
  const [paymentWindow, setPaymentWindow] = useState('10');
  const isInitialized = useRef(false);

  const { data: chainsData } = useQuery({
    queryKey: ['chains'],
    queryFn: () => api.listChains(),
  });

  const { data: tokensData } = useQuery({
    queryKey: ['tokens'],
    queryFn: () => api.listTokens(),
  });

  const chains = chainsData?.data || [];
  const tokens = tokensData?.tokens || [];
  const resolveChainId = useCallback(
    (chain: any) => chain?.chainId ?? chain?.chain_id ?? chain?.id ?? chain?.name,
    []
  );

  // Filter chains based on selected token
  const availableChains = useMemo(() => {
    if (!token || !tokens.length) return chains;

    const selectedToken = tokens.find((t: any) => t.symbol === token);
    if (!selectedToken?.chains) return chains;

    // Get chain IDs that support the selected token
    const supportedChainIds = new Set(
      selectedToken.chains.map((c: any) => c.chainId)
    );

    // Filter chains to only those that support the token
    return chains.filter((c: any) =>
      supportedChainIds.has(resolveChainId(c))
    );
  }, [token, tokens, chains, resolveChainId]);

  // Set default chain if not already set and chains are loaded
  // Or reset chain if current chain doesn't support selected token
  useEffect(() => {
    if (!isInitialized.current && !chain && availableChains.length > 0) {
      const firstChain = availableChains[0];
      setChain(resolveChainId(firstChain));
      isInitialized.current = true;
    } else if (chain && availableChains.length > 0) {
      // Check if current chain is still valid for selected token
      const isChainAvailable = availableChains.some(
        (c: any) => resolveChainId(c) === chain
      );
      if (!isChainAvailable) {
        // Reset to first available chain
        setChain(resolveChainId(availableChains[0]));
      }
    }
  }, [chain, availableChains, resolveChainId]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/orders', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Order created successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create order');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      orderReference: orderReference || undefined,
      amount: amount.trim(),
      currency: token,
      chainId: chain,
      paymentWindow: parseInt(paymentWindow, 10),
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Plus className="w-5 h-5" />
            Create New Order
          </DialogTitle>
          <DialogDescription>
            Create a new payment order to receive stable coin payments from customers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              External Order Reference (Optional)
            </label>
            <Input
              value={orderReference}
              onChange={(e) => setOrderReference(e.target.value)}
              placeholder="shop_order_12345"
            />
            <p className="text-xs text-muted-foreground mt-1">For your internal tracking</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Amount *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Token *
            </label>
            <Select value={token} onValueChange={setToken} required>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((t: any) => (
                  <SelectItem key={`token-${t.symbol}-${t.id || t.symbol}`} value={t.symbol}>
                    {t.symbol} - {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Chain *
            </label>
            <Select value={chain} onValueChange={setChain} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a chain" />
              </SelectTrigger>
              <SelectContent>
                {availableChains.map((c: any, index: number) => (
                  <SelectItem key={`chain-${resolveChainId(c) || index}`} value={resolveChainId(c)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableChains.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                ⚠️ No chains available for {token}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Payment Window (Optional)
            </label>
            <Input
              type="number"
              min="1"
              value={paymentWindow}
              onChange={(e) => setPaymentWindow(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">minutes (default: 10 min)</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} className="flex-1">
              {createMutation.isPending ? 'Creating...' : 'Create Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrdersTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Order ID / Reference</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Received</TableHead>
          <TableHead>Chain</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[1, 2, 3, 4, 5].map((i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
