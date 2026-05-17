import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ExternalLink, ChevronLeft, ChevronRight, Landmark, RefreshCw } from 'lucide-react';
import { formatRelativeTime } from '@/lib/time-utils';
import { getExplorerUrl } from '@/lib/explorer';
import { EmptyState } from '@/components/shared/EmptyState';

/**
 * All Deposits Table Component
 * Shows all deposit transfers with filtering
 */
export function AllDepositsTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['deposits', 'transfers', page, statusFilter, searchQuery],
    queryFn: () =>
      api.listTransfers({
        businessType: 'deposit',
        page: page.toString(),
        limit: pageSize.toString(),
      }),
    refetchInterval: 10000,
  });

  const deposits = data?.data || [];

  // Client-side filtering
  const filteredDeposits = deposits.filter((deposit: any) => {
    // Status filter
    if (statusFilter === 'confirmed' && !deposit.is_confirmed) return false;
    if (statusFilter === 'confirming' && deposit.is_confirmed) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        deposit.deposit_reference?.toLowerCase().includes(query) ||
        deposit.to_address?.toLowerCase().includes(query) ||
        deposit.transaction_hash?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Reserved for future use
  // const handleClearFilters = () => {
  //   setStatusFilter('all');
  //   setSearchQuery('');
  // };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by reference, address, or tx hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="confirming">Confirming</SelectItem>
          </SelectContent>
        </Select>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['deposits'] })}
          disabled={isLoading}
          title="Refresh list"
          aria-label="Refresh list"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <TableSkeleton />
        </div>
      ) : filteredDeposits.length === 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <EmptyState
            icon={Landmark}
            title={searchQuery || statusFilter !== 'all' ? 'No deposits found' : 'No deposits yet'}
            description={
              searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters to locate the deposit you are looking for.'
                : 'When customers send funds, incoming and confirmed deposits will be listed here for tracking.'
            }
            helpHref="https://docs.payin.com/en/guide/deposit-service.html"
            helpLabel="View deposits guide"
            className="py-16"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeposits.map((deposit: any) => (
                <TableRow key={deposit.id}>
                  <TableCell>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(deposit.detected_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium truncate max-w-[150px] block">
                      {deposit.deposit_reference || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">{deposit.amount}</span>
                      <span className="text-xs text-muted-foreground">{deposit.token}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {deposit.chain}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono truncate max-w-[120px] block">
                      {deposit.to_address}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge isConfirmed={deposit.is_confirmed} />
                  </TableCell>
                  <TableCell>
                    <a
                      href={getExplorerUrl(deposit.chain, deposit.transaction_hash, 'tx')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && filteredDeposits.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredDeposits.length} deposits
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={deposits.length < pageSize}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Status Badge Component
 */
function StatusBadge({
  isConfirmed,
}: {
  isConfirmed: boolean;
}) {
  if (isConfirmed) {
    return (
      <Badge className="text-xs bg-green-500/20 text-green-700 dark:text-green-400">
        ✓ Confirmed
      </Badge>
    );
  }

  return (
    <Badge className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-400">
      Confirming
    </Badge>
  );
}

/**
 * Table Loading Skeleton
 */
function TableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Chain</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
