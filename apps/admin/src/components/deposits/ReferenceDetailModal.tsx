import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, ExternalLink, TrendingUp, Wallet, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/time-utils';
import { getExplorerUrl } from '@/lib/explorer';

interface ReferenceDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depositReference: string | null;
}

/**
 * Reference Detail Modal Component
 * Shows complete information about a deposit reference
 */
export function ReferenceDetailModal({
  open,
  onOpenChange,
  depositReference,
}: ReferenceDetailModalProps) {
  const [depositFilter, setDepositFilter] = useState('all');

  // Fetch addresses for this reference
  const { data: addressesData, isLoading: addressesLoading } = useQuery({
    queryKey: ['depositAddresses', depositReference],
    queryFn: () => api.listDeposits({ depositReference }),
    enabled: !!depositReference && open,
    refetchInterval: 10000,
  });

  // Fetch deposits/transfers for this reference
  const { data: depositsData, isLoading: depositsLoading } = useQuery({
    queryKey: ['depositTransfers', depositReference],
    queryFn: () => api.listTransfers({ businessType: 'deposit', depositReference }),
    enabled: !!depositReference && open,
    refetchInterval: 10000,
  });

  const addresses = addressesData?.data || [];
  const deposits = depositsData?.data || [];

  // Filter deposits
  const filteredDeposits = deposits.filter((d: any) => {
    if (depositFilter === 'all') return true;
    if (depositFilter === 'confirmed') return d.is_confirmed;
    if (depositFilter === 'confirming') return !d.is_confirmed;
    // Filter by specific address
    return d.to_address === depositFilter;
  });

  // Calculate statistics
  const stats = {
    totalDeposits: deposits.length,
    totalAmount: deposits.reduce((sum: number, d: any) => sum + parseFloat(d.amount || 0), 0),
    firstDeposit: deposits.length > 0 ? deposits[deposits.length - 1].detected_at : null,
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
  };

  if (!depositReference) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2 text-foreground">
            <Wallet className="w-5 h-5 text-primary" />
            Deposit Reference Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Reference ID */}
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reference ID</p>
                <p className="text-lg font-semibold text-foreground">{depositReference}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyAddress(depositReference)}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>

          {/* Statistics */}
          {depositsLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Total Deposits"
                value={stats.totalDeposits.toString()}
                icon={<TrendingUp className="w-4 h-4 text-muted-foreground" />}
              />
              <StatCard
                label="Total Amount"
                value={`$${stats.totalAmount.toFixed(2)}`}
                icon={<TrendingUp className="w-4 h-4 text-muted-foreground" />}
              />
              <StatCard
                label="First Deposit"
                value={stats.firstDeposit ? formatRelativeTime(stats.firstDeposit) : 'N/A'}
                icon={<Clock className="w-4 h-4 text-muted-foreground" />}
              />
            </div>
          )}

          {/* Current Bound Addresses */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Wallet className="w-4 h-4 text-primary" />
              Current Bound Addresses ({addresses.length})
            </h3>

            {addressesLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : addresses.length === 0 ? (
              <div className="border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                No addresses currently bound
              </div>
            ) : (
              <div className="border border-border rounded-lg divide-y divide-border">
                {addresses.map((addr: any) => (
                  <div key={addr.address} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs uppercase">
                          {addr.protocol}
                        </Badge>
                        <span className="text-xs font-mono truncate text-foreground">{addr.address}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {addr.deposit_count || 0} deposits
                        {addr.allocated_at && ` • Bound ${formatRelativeTime(addr.allocated_at)}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyAddress(addr.address)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a
                          href={getExplorerUrl(addr.protocol === 'evm' ? 'ethereum-sepolia' : 'tron-nile', addr.address, 'address')}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deposit History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <TrendingUp className="w-4 h-4 text-primary" />
                Deposit History ({filteredDeposits.length})
              </h3>

              {/* Filter */}
              <Select value={depositFilter} onValueChange={setDepositFilter}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Deposits</SelectItem>
                  <SelectItem value="confirmed">Confirmed Only</SelectItem>
                  <SelectItem value="confirming">Confirming Only</SelectItem>
                  {addresses.length > 0 && addresses.map((addr: any) => (
                    <SelectItem key={addr.address} value={addr.address}>
                      {addr.protocol.toUpperCase()}: {addr.address.slice(0, 10)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {depositsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : filteredDeposits.length === 0 ? (
              <div className="border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                No deposits found
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Chain</TableHead>
                      <TableHead className="text-xs">Address</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeposits.map((deposit: any) => (
                      <TableRow key={deposit.id} className="text-xs">
                        <TableCell className="whitespace-nowrap text-foreground">
                          {formatRelativeTime(deposit.detected_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-foreground">{deposit.amount}</span>
                            <span className="text-muted-foreground">{deposit.token}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {deposit.chain}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono truncate max-w-[120px] block text-foreground">
                            {deposit.to_address}
                          </span>
                        </TableCell>
                        <TableCell>
                          {deposit.is_confirmed ? (
                            <Badge className="text-xs bg-green-500/20 text-green-700 dark:text-green-400">
                              Confirmed
                            </Badge>
                          ) : (
                            <Badge className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
                              Confirming
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <a
                            href={getExplorerUrl(deposit.chain, deposit.transaction_hash, 'tx')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Stat Card Component
 */
function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
