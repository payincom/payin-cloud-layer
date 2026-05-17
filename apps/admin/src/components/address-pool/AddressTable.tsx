import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { toast } from 'sonner';
import { AddressDetailModal } from './AddressDetailModal';

interface AddressTableProps {
  protocol: string | null; // null for "all protocols" view
  showProtocolColumn?: boolean;
  statusFilter?: string;
  typeFilter?: string;
  searchQuery?: string;
}

/**
 * Address Table Component
 * Protocol-agnostic table for displaying addresses with pagination
 */
export function AddressTable({
  protocol,
  showProtocolColumn = false,
  statusFilter = 'all',
  typeFilter = 'all',
  searchQuery = '',
}: AddressTableProps) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [selectedAddress, setSelectedAddress] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['addresses', protocol, page],
    queryFn: () =>
      api.getAddresses({
        protocol: protocol || undefined,
        page,
        pageSize,
      }),
    refetchInterval: 10000,
  });

  const allAddresses = data?.data?.addresses || [];

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, searchQuery]);

  // Client-side filtering
  const filteredAddresses = allAddresses.filter((addr: any) => {
    // Status filter
    if (statusFilter !== 'all' && addr.status !== statusFilter) {
      return false;
    }

    // Type filter
    if (typeFilter !== 'all') {
      if (typeFilter === 'new' && addr.type !== null) {
        return false;
      }
      if (typeFilter !== 'new' && addr.type !== typeFilter) {
        return false;
      }
    }

    // Search filter (address or externalId)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesAddress = addr.address.toLowerCase().includes(query);
      const matchesRef = addr.externalId?.toLowerCase().includes(query);
      if (!matchesAddress && !matchesRef) {
        return false;
      }
    }

    return true;
  });

  // Client-side pagination
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedAddresses = filteredAddresses.slice(startIndex, endIndex);

  const addresses = paginatedAddresses;
  const total = filteredAddresses.length;
  const totalPages = Math.ceil(total / pageSize);

  const handleCopy = async (address: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row click
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy address');
    }
  };

  const handleRowClick = (addr: any) => {
    setSelectedAddress(addr);
    setModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      available: 'default' as const,
      allocated: 'secondary' as const,
      bound: 'outline' as const,
      archived: 'destructive' as const,
    };
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTypeBadge = (type: string | null) => {
    if (!type) return <span className="text-muted-foreground/50 text-xs">—</span>;
    return (
      <Badge variant="outline" className="text-xs">
        {type === 'order' ? 'Order' : 'Deposit'}
      </Badge>
    );
  };

  if (isLoading) {
    return <AddressTableSkeleton showProtocolColumn={showProtocolColumn} />;
  }

  if (addresses.length === 0) {
    return (
      <div className="border border-border rounded-lg p-12 text-center bg-muted/30">
        <p className="text-muted-foreground">
          {protocol
            ? `No addresses found for ${protocol.toUpperCase()} protocol`
            : 'No addresses found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {showProtocolColumn && <TableHead className="w-24">Protocol</TableHead>}
              <TableHead className="min-w-32 lg:min-w-96">Address</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-48">Reference</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {addresses.map((addr: any) => (
              <TableRow
                key={addr.address}
                className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleRowClick(addr)}
              >
                {showProtocolColumn && (
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {addr.protocol.toUpperCase()}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>
                  <div className="font-mono text-sm text-foreground">
                    {/* Small screens: 0x1234...5678 */}
                    <span className="sm:hidden">
                      {addr.address.slice(0, 6)}...{addr.address.slice(-4)}
                    </span>
                    {/* Medium screens: 0x1234567890ab...cdef */}
                    <span className="hidden sm:inline lg:hidden">
                      {addr.address.slice(0, 14)}...{addr.address.slice(-4)}
                    </span>
                    {/* Large screens: full address */}
                    <span className="hidden lg:inline">
                      {addr.address}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(addr.status)}</TableCell>
                <TableCell>{getTypeBadge(addr.type)}</TableCell>
                <TableCell>
                  {addr.externalId ? (
                    <div className="text-sm text-muted-foreground truncate" title={addr.externalId}>
                      {addr.externalId}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleCopy(addr.address, e)}
                    title="Copy address"
                    className="hover:bg-muted"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{' '}
            addresses
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Address Detail Modal */}
      <AddressDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        address={selectedAddress}
        onAddressUpdated={() => refetch()}
      />
    </div>
  );
}

/**
 * Address Table Skeleton
 * Loading skeleton for address table
 */
function AddressTableSkeleton({ showProtocolColumn }: { showProtocolColumn: boolean }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {showProtocolColumn && <TableHead className="w-24">Protocol</TableHead>}
            <TableHead className="min-w-32 lg:min-w-96">Address</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-24">Type</TableHead>
            <TableHead className="w-48">Reference</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRow key={i}>
              {showProtocolColumn && (
                <TableCell>
                  <Skeleton className="h-5 w-12" />
                </TableCell>
              )}
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
