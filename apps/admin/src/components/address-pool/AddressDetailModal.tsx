import { useState } from 'react';
import { ExternalLink, Copy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api';
import { getExplorerUrlsForProtocol } from '@/lib/chain-explorer';

interface AddressDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: {
    address: string;
    protocol: 'evm' | 'tron' | 'solana';
    status: 'idle' | 'allocated' | 'bound' | 'archived';
    type: 'order' | 'deposit' | null;
    externalId: string | null;
    allocatedAt: Date | null;
    recycledAt: Date | null;
    cooldownUntil: Date | null;
    createdAt: Date;
  } | null;
  onAddressUpdated?: () => void;
}

/**
 * Address Detail Modal Component
 * Shows detailed information about an address in a modal with multiple tabs
 */
export function AddressDetailModal({ open, onOpenChange, address, onAddressUpdated }: AddressDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isArchiving, setIsArchiving] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false);

  // Fetch available chains
  const { data: chainsData } = useQuery({
    queryKey: ['chains'],
    queryFn: async () => {
      const response = await api.listChains();
      return response;
    },
    enabled: open && !!address,
  });

  if (!address) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address.address);
      toast.success('Address copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy address');
    }
  };

  const handleArchive = async () => {
    if (!address) return;

    setIsArchiving(true);
    try {
      await api.archiveAddress(address.address);
      toast.success('Address archived successfully');
      onAddressUpdated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive address');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!address) return;

    setIsUnarchiving(true);
    try {
      await api.unarchiveAddress(address.address);
      toast.success('Address restored successfully');
      onAddressUpdated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore address');
    } finally {
      setIsUnarchiving(false);
    }
  };

  // Get all explorer URLs for this address based on its protocol
  const explorerLinks = address
    ? getExplorerUrlsForProtocol(
        address.protocol,
        address.address,
        chainsData?.data?.map((chain: any) => ({
          chainId: chain.chainId,
          protocol: chain.protocol,
          name: chain.name,
        }))
      )
    : [];

  const getStatusBadge = () => {
    const statusConfig: Record<
      'idle' | 'allocated' | 'bound' | 'archived',
      { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }
    > = {
      idle: { variant: 'default', label: 'Idle' },
      allocated: { variant: 'secondary', label: 'Allocated' },
      bound: { variant: 'outline', label: 'Bound' },
      archived: { variant: 'destructive', label: 'Archived' },
    };

    const config = statusConfig[address.status];
    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Address Details</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          {/* Tab 1: Overview */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Address Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Address Information
              </h3>
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm text-foreground bg-background px-2 py-1 rounded border break-all">
                      {address.address}
                    </code>
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 w-7 p-0 shrink-0">
                      <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Protocol</p>
                    <Badge variant="outline">{address.protocol.toUpperCase()}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Status</p>
                    {getStatusBadge()}
                  </div>
                </div>
              </div>
            </div>

            {/* Current Usage */}
            {(address.type || address.externalId) && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Current Usage
                </h3>
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  {address.type && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Type</p>
                      <Badge variant="outline" className="text-xs">
                        {address.type === 'order' ? 'Order Payment' : 'User Deposit'}
                      </Badge>
                    </div>
                  )}

                  {address.externalId && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Reference</p>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm text-foreground">{address.externalId}</code>
                      </div>
                    </div>
                  )}

                  {address.allocatedAt && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Allocated At</p>
                      <p className="text-sm text-foreground">
                        {address.allocatedAt.toLocaleString()} (
                        {formatDistanceToNow(address.allocatedAt, { addSuffix: true })})
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lifecycle */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Lifecycle
              </h3>
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm text-foreground">
                    {address.createdAt.toLocaleString()} (
                    {formatDistanceToNow(address.createdAt, { addSuffix: true })})
                  </p>
                </div>

                {address.recycledAt && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Last Recycled</p>
                    <p className="text-sm text-foreground">
                      {address.recycledAt.toLocaleString()} (
                      {formatDistanceToNow(address.recycledAt, { addSuffix: true })})
                    </p>
                  </div>
                )}

                {address.cooldownUntil && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Cooldown Until</p>
                    <p className="text-sm text-foreground">
                      {address.cooldownUntil > new Date() ? (
                        <>
                          {address.cooldownUntil.toLocaleString()} (
                          {formatDistanceToNow(address.cooldownUntil, { addSuffix: true })})
                        </>
                      ) : (
                        <span className="text-green-500">Ready to use</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Blockchain Explorer */}
            {explorerLinks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Blockchain Explorer
                  {explorerLinks.length > 1 && (
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      ({explorerLinks.length} chains available)
                    </span>
                  )}
                </h3>
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="space-y-2">
                    {explorerLinks.map((link) => (
                      <a
                        key={link.chainId}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">
                          {link.chainName}
                          <span className="text-xs text-muted-foreground ml-2">
                            ({link.explorerName})
                          </span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Actions */}
          <TabsContent value="actions" className="mt-4 space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleCopy}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Address
              </Button>
            </div>

            {/* Address Management Actions */}
            {address.status === 'idle' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Address Management</h3>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={handleArchive}
                  disabled={isArchiving}
                >
                  {isArchiving ? 'Archiving...' : 'Archive Address'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Archive this address to remove it from the available pool. You can restore it later.
                </p>
              </div>
            )}

            {address.status === 'archived' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Address Management</h3>
                <Button
                  variant="default"
                  className="w-full justify-start"
                  onClick={handleUnarchive}
                  disabled={isUnarchiving}
                >
                  {isUnarchiving ? 'Restoring...' : 'Restore Address'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Restore this archived address to make it available for allocation again.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
