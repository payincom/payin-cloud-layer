import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Unlink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface UnbindAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: {
    address: string;
    protocol: 'evm' | 'tron';
    depositReference: string;
    depositCount?: number;
    otherAddressCount?: number;
  } | null;
  onSuccess?: () => void;
}

/**
 * Unbind Address Confirmation Dialog
 * Shows warning and context about unbinding a deposit address
 */
export function UnbindAddressDialog({
  open,
  onOpenChange,
  address,
  onSuccess,
}: UnbindAddressDialogProps) {
  const [isUnbinding, setIsUnbinding] = useState(false);

  const handleUnbind = async () => {
    if (!address) return;

    setIsUnbinding(true);
    try {
      await api.unbindAddressByAddress({
        address: address.address,
        protocol: address.protocol,
      });

      toast.success('Address unbound successfully', {
        description: `${address.address.slice(0, 10)}...${address.address.slice(-8)} has been unbound`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to unbind address:', error);
      toast.error('Failed to unbind address', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsUnbinding(false);
    }
  };

  if (!address) return null;

  const isLastAddress = (address.otherAddressCount || 0) === 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <Unlink className="w-5 h-5 text-destructive" />
            Confirm Unbind Address
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              {/* Address Info */}
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Address</span>
                  <Badge variant="outline" className="text-xs">
                    {address.protocol.toUpperCase()}
                  </Badge>
                </div>
                <div className="font-mono text-sm break-all text-foreground">
                  {address.address}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-medium text-foreground">{address.depositReference}</span>
                </div>
                {address.depositCount !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Historical Deposits</span>
                    <span className="font-medium text-foreground">{address.depositCount}</span>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">This will stop monitoring new deposits to this address.</p>
                  </div>
                </div>

                <div className="pl-6 space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-muted-foreground">Historical deposit records will be preserved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-muted-foreground">Address can be re-bound later if needed</span>
                  </div>
                  {!isLastAddress && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span className="text-muted-foreground">Other addresses for this reference remain active</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Last Address Warning */}
              {isLastAddress && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-destructive">
                        This is the last address for {address.depositReference}!
                      </p>
                      <p className="text-muted-foreground">
                        After unbinding, no addresses will be monitoring deposits for this reference.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Other Addresses Info */}
              {!isLastAddress && address.otherAddressCount !== undefined && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>ℹ️</span>
                  <span>
                    {address.depositReference} still has {address.otherAddressCount} other{' '}
                    {address.otherAddressCount === 1 ? 'address' : 'addresses'} bound
                  </span>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUnbinding}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUnbind}
            disabled={isUnbinding}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isUnbinding ? 'Unbinding...' : isLastAddress ? 'Still Unbind' : 'Confirm Unbind'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
