import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { XCircle, Plus, TrendingUp, DollarSign, Users, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { DepositReferencesTable } from '@/components/deposits/DepositReferencesTable';
import { BoundAddressesTable } from '@/components/deposits/BoundAddressesTable';
import { AllDepositsTable } from '@/components/deposits/AllDepositsTable';
import { InlineRevenueCard } from '@/components/shared/InlineRevenueCard';
import { TimeRangeSelector, getTimeRangeMs } from '@/components/shared/TimeRangeSelector';
import { useGlobalTimeRange } from '@/hooks/useGlobalTimeRange';
import { AddressPoolSetupGuide } from '@/components/address-pool/AddressPoolSetupGuide';
import { useAddressPoolStatus } from '@/hooks/useAddressPoolStatus';

/**
 * Deposits Page
 * Manages deposit addresses and monitors user deposits
 */
export default function Deposits() {
  const [timeRange, setTimeRange] = useGlobalTimeRange();
  const [activeTab, setActiveTab] = useState('deposits');
  const [bindDialogOpen, setBindDialogOpen] = useState(false);

  const {
    isLoading: poolSummaryLoading,
    isError: poolSummaryError,
    hasAnyAddresses,
  } = useAddressPoolStatus();

  const shouldLoadDepositsData = !poolSummaryLoading && (hasAnyAddresses || poolSummaryError);

  // Service configuration
  const { data: serviceConfig } = useQuery({
    queryKey: ['config', 'services.deposits_enabled'],
    queryFn: () => api.getSystemConfig('services.deposits_enabled'),
    refetchInterval: 5000,
    enabled: shouldLoadDepositsData,
  });

  const isServiceEnabled = serviceConfig?.data?.value ?? true;

  // Fetch all deposits for statistics
  const { data: allDepositsData } = useQuery({
    queryKey: ['deposits', 'all'],
    queryFn: () => api.listTransfers({ businessType: 'deposit', limit: '1000' }),
    refetchInterval: 10000,
    enabled: shouldLoadDepositsData,
  });

  const allDeposits = allDepositsData?.data || [];

  // Calculate statistics based on time range
  const stats = useMemo(() => {
    const now = new Date();
    const rangeMs = getTimeRangeMs(timeRange);
    const startDate = rangeMs ? new Date(now.getTime() - rangeMs) : null;

    const recentDeposits = allDeposits.filter((d: any) => {
      if (!d.is_confirmed) return false;
      if (!startDate) return true; // 'all' - include all confirmed deposits
      const depositDate = new Date(d.detected_at);
      return depositDate >= startDate;
    });

    const totalAmount: Record<string, number> = {};
    recentDeposits.forEach((d: any) => {
      const token = d.token || 'USDC';
      totalAmount[token] = (totalAmount[token] || 0) + parseFloat(d.amount || '0');
    });

    const uniqueReferences = new Set(recentDeposits.map((d: any) => d.deposit_reference).filter(Boolean));

    // All-time confirmed deposits
    const confirmedDeposits = allDeposits.filter((d: any) => d.is_confirmed);
    const allTimeAmount: Record<string, number> = {};
    confirmedDeposits.forEach((d: any) => {
      const token = d.token || 'USDC';
      allTimeAmount[token] = (allTimeAmount[token] || 0) + parseFloat(d.amount || '0');
    });

    return {
      count24h: recentDeposits.length,
      amount24h: totalAmount,
      activeUsers24h: uniqueReferences.size,
      totalCount: confirmedDeposits.length,
      totalAmount: allTimeAmount,
    };
  }, [allDeposits, timeRange]);

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
        <AddressPoolSetupGuide context="deposits" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {!isServiceEnabled && (
        <Card className="border-l-4 border-l-red-500 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-600 dark:text-red-400 mb-1">
                  Deposit Service is Disabled
                </h3>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  New deposit address binding requests will be rejected, but existing bound addresses will continue to monitor deposits normally.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted">
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="references">Users</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
        </TabsList>

        {/* Tab 1: All Deposits */}
        <TabsContent value="deposits" className="space-y-6">
          {/* Time Range Selector */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Deposits</h2>
              <p className="text-sm text-muted-foreground">
                View deposit transactions across all users
                {timeRange !== 'all' && ` • Last ${timeRange}`}
              </p>
            </div>
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          </div>

          {/* Overview Statistics */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Overview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InlineRevenueCard
                title="Total Volume"
                amounts={stats.totalAmount}
                icon={<DollarSign className="w-4 h-4" />}
              />

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Activity className="w-4 h-4" />
                    <span className="text-sm font-medium">Total Deposits</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{stats.totalCount}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {timeRange !== 'all' ? `in last ${timeRange}` : 'all time confirmed'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Active References</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">{stats.activeUsers24h}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {timeRange !== 'all' ? `in last ${timeRange}` : 'all time'}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Deposits Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transaction History</CardTitle>
              <p className="text-sm text-muted-foreground">
                Detailed view of all deposit transactions
              </p>
            </CardHeader>
            <CardContent>
              <AllDepositsTable />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: References */}
        <TabsContent value="references" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Deposit References</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    View all deposit references with statistics and bound addresses
                  </p>
                </div>
                <Dialog open={bindDialogOpen} onOpenChange={setBindDialogOpen}>
                  <DialogTrigger asChild>
                    <Button disabled={!isServiceEnabled} className="gap-2">
                      <Plus className="w-4 h-4" />
                      Bind New Address
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <BindAddressForm onSuccess={() => setBindDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <DepositReferencesTable />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Addresses */}
        <TabsContent value="addresses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bound Addresses</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage addresses bound to deposit references
              </p>
            </CardHeader>
            <CardContent>
              <BoundAddressesTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Bind Address Form Component
 */
function BindAddressForm({ onSuccess }: { onSuccess: () => void }) {
  const [depositReference, setDepositReference] = useState('');
  const [protocol, setProtocol] = useState<'evm' | 'tron'>('evm');
  const [isBinding, setIsBinding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!depositReference.trim()) {
      toast.error('Please enter a deposit reference');
      return;
    }

    setIsBinding(true);
    try {
      await api.bindUserAddress({
        depositReference: depositReference.trim(),
        protocol,
      });

      toast.success('Address bound successfully', {
        description: `A ${protocol.toUpperCase()} address has been bound to ${depositReference}`,
      });

      setDepositReference('');
      onSuccess();
    } catch (error) {
      console.error('Failed to bind address:', error);
      toast.error('Failed to bind address', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsBinding(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="text-foreground">Bind New Deposit Address</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="depositReference" className="text-foreground block mb-2">Deposit Reference</Label>
          <Input
            id="depositReference"
            placeholder="e.g., game_player_123, user_456"
            value={depositReference}
            onChange={(e) => setDepositReference(e.target.value)}
            disabled={isBinding}
          />
          <p className="text-xs text-muted-foreground">
            The external system's identifier for this deposit entity
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground block mb-2">Protocol</Label>
          <RadioGroup value={protocol} onValueChange={(value) => setProtocol(value as 'evm' | 'tron')}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="evm" id="evm" />
              <Label htmlFor="evm" className="font-normal cursor-pointer text-foreground">
                EVM (Ethereum, Polygon, etc.)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="tron" id="tron" />
              <Label htmlFor="tron" className="font-normal cursor-pointer text-foreground">
                Tron
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isBinding}>
          {isBinding ? 'Binding...' : 'Bind Address'}
        </Button>
      </div>
    </form>
  );
}
