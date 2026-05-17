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
import { Search, ChevronLeft, ChevronRight, Wallet, Eye, RefreshCw } from 'lucide-react';
import { formatRelativeTime } from '@/lib/time-utils';
import { ReferenceDetailModal } from './ReferenceDetailModal';

/**
 * Deposit References Table Component
 * Shows all deposit references with statistics
 */
export function DepositReferencesTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [protocolFilter, setProtocolFilter] = useState<'all' | 'evm' | 'tron'>('all');
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['depositReferences', page, searchQuery],
    queryFn: () =>
      api.listDepositReferences({
        page,
        limit: pageSize,
        search: searchQuery || undefined,
      }),
    refetchInterval: 10000,
  });

  const allReferences = data?.data || [];
  const pagination = (data as any)?.pagination;

  // Filter by protocol
  const references = allReferences.filter((ref: any) => {
    if (protocolFilter === 'all') return true;
    if (protocolFilter === 'evm') return ref.protocols.includes('evm');
    if (protocolFilter === 'tron') return ref.protocols.includes('tron');
    return true;
  });

  // Calculate protocol counts (reserved for future use)
  // const evmCount = allReferences.filter((ref: any) => ref.protocols.includes('evm')).length;
  // const tronCount = allReferences.filter((ref: any) => ref.protocols.includes('tron')).length;

  const handleRowClick = (reference: string) => {
    setSelectedReference(reference);
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deposit references..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select value={protocolFilter} onValueChange={(value: any) => { setProtocolFilter(value); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Protocols</SelectItem>
            <SelectItem value="evm">EVM</SelectItem>
            <SelectItem value="tron">Tron</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['depositReferences'] })}
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
      ) : references.length === 0 ? (
        <div className="p-12 text-center">
          <Wallet className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            {searchQuery
              ? 'No deposit references found matching your search'
              : 'No deposit references yet'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Protocols</TableHead>
                <TableHead className="text-right">Addresses</TableHead>
                <TableHead className="text-right">Total Deposits</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Last Deposit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {references.map((ref: any) => (
                <TableRow
                  key={ref.depositReference}
                  className="hover:bg-accent/50"
                >
                  <TableCell>
                    <span className="font-medium">{ref.depositReference}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {ref.protocols.map((protocol: string) => (
                        <Badge key={protocol} variant="outline" className="text-xs uppercase">
                          {protocol}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-medium">{ref.addressCount}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-medium">{ref.totalDeposits}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm">
                      {Object.entries(ref.totalAmount).length > 0 ? (
                        Object.entries(ref.totalAmount).map(([token, amount]: [string, any]) => (
                          <div key={token} className="flex items-center justify-end gap-1">
                            <span className="font-medium">{parseFloat(amount).toFixed(2)}</span>
                            <span className="text-muted-foreground text-xs">{token}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {ref.lastDepositAt ? formatRelativeTime(ref.lastDepositAt) : 'Never'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleRowClick(ref.depositReference)}
                    >
                      <Eye className="w-4 h-4" />
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && references.length > 0 && pagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
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
              disabled={page >= (pagination.totalPages || 1)}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <ReferenceDetailModal
        open={selectedReference !== null}
        onOpenChange={(open) => !open && setSelectedReference(null)}
        depositReference={selectedReference}
      />
    </div>
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
          <TableHead>Reference</TableHead>
          <TableHead>Protocols</TableHead>
          <TableHead className="text-right">Addresses</TableHead>
          <TableHead className="text-right">Total Deposits</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Last Deposit</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
