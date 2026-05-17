import { useState, useMemo, forwardRef, type ComponentPropsWithoutRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { X, DollarSign, ShoppingCart, TrendingUp, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TimeRangeSelector, getStartDateFromTimeRange, type TimeRange } from '@/components/shared/TimeRangeSelector';
import { cn } from '@/lib/utils';

const FullscreenDialogContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn('fixed inset-0 z-50 flex flex-col bg-background text-foreground focus:outline-none', className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
FullscreenDialogContent.displayName = 'FullscreenDialogContent';

type OrderStatus = 'all' | 'pending' | 'completed' | 'expired' | 'canceled';

type PaymentLinkOrder = {
  id: string;
  buyer_email?: string | null;
  status: 'pending' | 'completed' | 'expired' | 'canceled';
  amount?: string | null;
  selected_currency?: string | null;
  selected_chain?: string | null;
  created_at: string;
};

type PaymentLinkOrdersResponse = {
  success: boolean;
  data: PaymentLinkOrder[];
};

interface PaymentLinkOrdersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentLink: {
    id: string;
    title: string;
    description?: string | null;
    amount: string;
    currency?: string | null;
    status: 'draft' | 'published';
  } | null;
}

export function PaymentLinkOrdersModal({ open, onOpenChange, paymentLink }: PaymentLinkOrdersModalProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch orders for this payment link
  const { data: ordersResponse, isLoading } = useQuery<PaymentLinkOrdersResponse>({
    queryKey: ['payment-link-orders', paymentLink?.id],
    queryFn: () => (paymentLink ? api.listPaymentLinkOrders(paymentLink.id) : Promise.resolve({ success: true, data: [] })),
    enabled: !!paymentLink,
    refetchInterval: 10000,
  });

  const allOrders: PaymentLinkOrder[] = Array.isArray(ordersResponse?.data) ? ordersResponse.data : [];

  // Filter orders by time range and status
  const filteredOrders = useMemo<PaymentLinkOrder[]>(() => {
    let filtered = allOrders;

    // Filter by time range
    const startDate = getStartDateFromTimeRange(timeRange);
    if (startDate) {
      filtered = filtered.filter((order) => new Date(order.created_at) >= startDate);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    return filtered;
  }, [allOrders, timeRange, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    const completed = filteredOrders.filter((order) => order.status === 'completed');
    const revenue: Record<string, number> = {};

    completed.forEach((order) => {
      const currency = order.selected_currency || 'USDC';
      const amount = parseFloat(order.amount || '0');
      revenue[currency] = (revenue[currency] || 0) + amount;
    });

    const completionRate = filteredOrders.length > 0
      ? (completed.length / filteredOrders.length) * 100
      : 0;

    return {
      totalOrders: filteredOrders.length,
      completedOrders: completed.length,
      revenue,
      completionRate,
    };
  }, [filteredOrders]);

  // Pagination
  const paginatedOrders = useMemo<PaymentLinkOrder[]>(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, page, pageSize]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);

  if (!paymentLink) return null;

  const currencyLabel = paymentLink.currency ?? 'N/A';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FullscreenDialogContent>
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-9 w-9"
              >
                <X className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-lg font-semibold">{paymentLink.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {currencyLabel} {paymentLink.amount} • {paymentLink.status}
                </p>
              </div>
            </div>
            <Badge variant={paymentLink.status === 'published' ? 'default' : 'secondary'}>
              {paymentLink.status}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Orders</span>
                {timeRange !== 'all' && (
                  <span className="text-sm text-muted-foreground">• Last {timeRange}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    {timeRange !== 'all' ? `in last ${timeRange}` : 'all time'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completedOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.completionRate.toFixed(1)}% completion rate
                  </p>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {Object.keys(stats.revenue).length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(stats.revenue).map(([currency, amount]) => (
                        <div key={currency} className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold">{amount.toFixed(2)}</span>
                          <span className="text-sm text-muted-foreground">{currency}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-muted-foreground">$0.00</div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    From completed orders
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Orders Table */}
            {isLoading ? (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Chain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                <h3 className="mt-4 text-lg font-semibold">No orders yet</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {statusFilter !== 'all' || timeRange !== 'all'
                    ? 'No orders found matching your filters'
                    : 'Orders will appear here when customers make purchases'}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Chain</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">
                            {order.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {order.buyer_email}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-baseline gap-1">
                              <span className="font-medium">{order.amount}</span>
                              <span className="text-xs text-muted-foreground">
                                {order.selected_currency}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {order.selected_chain || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                order.status === 'completed'
                                  ? 'default'
                                  : order.status === 'pending'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(order.created_at), 'MMM d, yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredOrders.length)} of {filteredOrders.length} orders
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </FullscreenDialogContent>
    </Dialog>
  );
}
