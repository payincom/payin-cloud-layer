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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, MoreHorizontal, Copy, ExternalLink, Unlink, ChevronLeft, ChevronRight, Wallet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/time-utils';
import { getExplorerUrl } from '@/lib/explorer';
import { UnbindAddressDialog } from './UnbindAddressDialog';

/**
 * Bound Addresses Table Component
 * Shows all bound deposit addresses with management actions
 */
export function BoundAddressesTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [unbindAddress, setUnbindAddress] = useState<any | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['depositAddresses', page],
    queryFn: () =>
      api.listDeposits({
        page: page.toString(),
        limit: '100',
      }),
    refetchInterval: 10000,
  });

  const addresses = data?.data || [];

  // Client-side filtering
  const filteredAddresses = addresses.filter((addr: any) => {
    // Protocol filter
    if (protocolFilter !== 'all' && addr.protocol !== protocolFilter) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        addr.deposit_reference?.toLowerCase().includes(query) ||
        addr.address?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Group addresses by deposit reference to count
  const getReferenceAddressCount = (depositReference: string): number => {
    return addresses.filter((a: any) => a.deposit_reference === depositReference).length;
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
  };

  const handleUnbindClick = (addr: any) => {
    const referenceAddressCount = getReferenceAddressCount(addr.deposit_reference);
    setUnbindAddress({
      address: addr.address,
      protocol: addr.protocol,
      depositReference: addr.deposit_reference,
      depositCount: addr.deposit_count || 0,
      otherAddressCount: referenceAddressCount - 1, // Exclude current address
    });
  };

  const handleUnbindSuccess = () => {
    refetch();
  };

  // Reserved for future use
  // const handleClearFilters = () => {
  //   setProtocolFilter('all');
  //   setSearchQuery('');
  // };

  // Group consecutive rows with same reference for visual grouping
  const getRowClassName = (addr: any, index: number): string => {
    if (index === 0) return '';
    const prevAddr = filteredAddresses[index - 1];
    if (prevAddr && prevAddr.deposit_reference === addr.deposit_reference) {
      return 'bg-muted/30 border-l-4 border-l-primary/30';
    }
    return '';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by reference or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Protocol Filter */}
        <Select value={protocolFilter} onValueChange={setProtocolFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Protocol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Protocols</SelectItem>
            <SelectItem value="evm">EVM</SelectItem>
            <SelectItem value="tron">Tron</SelectItem>
          </SelectContent>
        </Select>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['depositAddresses'] })}
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
      ) : filteredAddresses.length === 0 ? (
        <div className="p-12 text-center">
          <Wallet className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            {searchQuery || protocolFilter !== 'all'
              ? 'No addresses found matching your filters'
              : 'No bound addresses yet'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocol</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Deposits</TableHead>
                <TableHead>Bound At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAddresses.map((addr: any, index: number) => (
                <TableRow key={addr.address} className={getRowClassName(addr, index)}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs uppercase">
                      {addr.protocol}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono truncate max-w-[200px] block">
                      {addr.address}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate max-w-[150px]">
                        {addr.deposit_reference}
                      </span>
                      {getReferenceAddressCount(addr.deposit_reference) > 1 && (
                        <Badge variant="secondary" className="text-xs">
                          {getReferenceAddressCount(addr.deposit_reference)}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {addr.deposit_count || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {addr.allocated_at ? formatRelativeTime(addr.allocated_at) : 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopyAddress(addr.address)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Address
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a
                            href={getExplorerUrl(addr.protocol === 'evm' ? 'ethereum-sepolia' : 'tron-nile', addr.address, 'address')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View on Explorer
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleUnbindClick(addr)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Unlink className="mr-2 h-4 w-4" />
                          Unbind Address
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && filteredAddresses.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredAddresses.length} addresses
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
              disabled={addresses.length < 100}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Unbind Dialog */}
      <UnbindAddressDialog
        open={unbindAddress !== null}
        onOpenChange={(open) => !open && setUnbindAddress(null)}
        address={unbindAddress}
        onSuccess={handleUnbindSuccess}
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
          <TableHead>Protocol</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Deposits</TableHead>
          <TableHead>Bound At</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(5)].map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
