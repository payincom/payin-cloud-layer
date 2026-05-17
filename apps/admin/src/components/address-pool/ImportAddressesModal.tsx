import { useRef, useState } from 'react';
import { Upload, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface ImportAddressesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocol: string;
  displayName: string;
  onImportSuccess?: () => void;
}

interface AddressData {
  address: string;
  derivationIndex?: number | null;
}

interface ValidationResult {
  valid: number;
  invalid: number;
  duplicate: number;
  addresses: Array<{
    address: string;
    derivationIndex?: number | null;
    status: 'valid' | 'invalid' | 'duplicate';
    error?: string;
  }>;
}

/**
 * Import Addresses Modal Component
 * Allows operators to import plain address lists via CSV upload or paste.
 */
export function ImportAddressesModal({
  open,
  onOpenChange,
  protocol,
  displayName,
  onImportSuccess,
}: ImportAddressesModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputText, setInputText] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const resetForm = () => {
    setInputText('');
    setValidationResult(null);
    setIsValidating(false);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const parseCSV = (text: string): AddressData[] => {
    const lines = text.trim().split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const firstLine = lines[0];
    const hasHeader = firstLine.toLowerCase().includes('address');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    // Check if this is two-column format (address,derivation_index)
    const hasDeriIndex = hasHeader && firstLine.toLowerCase().includes('derivation');

    return dataLines.map(line => {
      const parts = line.split(',').map(p => p.trim());

      if (hasDeriIndex && parts.length >= 2) {
        // Two-column format: address,derivation_index
        return {
          address: parts[0] || '',
          derivationIndex: parts[1] ? parseInt(parts[1], 10) : null,
        };
      } else {
        // Simple address list (one per line)
        return {
          address: parts[0] || '',
        };
      }
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setInputText(text);

      const parsed = parseCSV(text);
      toast.success(`Loaded ${parsed.length} addresses`);
    } catch (error) {
      toast.error('Failed to read file. Please check the format.');
    } finally {
      event.target.value = '';
    }
  };

  const validateAddress = (address: string): { valid: boolean; error?: string } => {
    if (protocol === 'evm') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return { valid: false, error: 'Invalid EVM address format' };
      }
    } else if (protocol === 'tron') {
      if (!/^T[a-zA-Z0-9]{33}$/.test(address)) {
        return { valid: false, error: 'Invalid Tron address format' };
      }
    } else if (protocol === 'solana') {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        return { valid: false, error: 'Invalid Solana address format' };
      }
    }
    return { valid: true };
  };

  const handleValidate = () => {
    if (!inputText.trim()) {
      toast.error('Please enter addresses or upload a file');
      return;
    }

    setIsValidating(true);

    try {
      const parsed = parseCSV(inputText);

      if (parsed.length === 0) {
        toast.error('No valid addresses found');
        setIsValidating(false);
        return;
      }

      const seen = new Set<string>();
      const validated = parsed.map(item => {
        const address = item.address;

        // Check for duplicates
        if (seen.has(address.toLowerCase())) {
          return {
            address: item.address,
            derivationIndex: item.derivationIndex,
            status: 'duplicate' as const,
          };
        }
        seen.add(address.toLowerCase());

        // Validate address format
        const addressValidation = validateAddress(address);
        if (!addressValidation.valid) {
          return {
            address: item.address,
            derivationIndex: item.derivationIndex,
            status: 'invalid' as const,
            error: addressValidation.error,
          };
        }

        return {
          address: item.address,
          derivationIndex: item.derivationIndex,
          status: 'valid' as const,
        };
      });

      const result: ValidationResult = {
        valid: validated.filter(v => v.status === 'valid').length,
        invalid: validated.filter(v => v.status === 'invalid').length,
        duplicate: validated.filter(v => v.status === 'duplicate').length,
        addresses: validated,
      };

      setValidationResult(result);
      setIsValidating(false);

      if (result.valid > 0) {
        toast.success(`Validation complete: ${result.valid} valid addresses`);
      } else {
        toast.error('No valid addresses found');
      }
    } catch (error) {
      toast.error('Validation failed. Please check the format.');
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!validationResult || validationResult.valid === 0) {
      toast.error('No valid addresses to import');
      return;
    }

    setIsImporting(true);

    try {
      const validAddresses = validationResult.addresses
        .filter(v => v.status === 'valid')
        .map((v) => ({
          address: v.address,
          protocol: protocol, // Use UI selection
          derivationIndex: v.derivationIndex !== undefined ? v.derivationIndex : null,
          masterPublicKey: null, // Not included in CSV
        }));

      await api.addAddressesToPool(validAddresses);

      toast.success(`Successfully imported ${validAddresses.length} addresses`);

      // Notify parent component
      onImportSuccess?.();

      // Close modal and reset
      handleClose();
    } catch (error) {
      toast.error('Failed to import addresses');
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import {displayName} Addresses</DialogTitle>
          <DialogDescription>
            Import addresses to the {displayName} address pool
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1.5">
            <h3 className="text-sm font-semibold text-foreground">Address list import</h3>
            <p className="text-sm text-muted-foreground">
              Paste addresses below or use the Upload CSV button to bring them in bulk.{' '}
              <a
                href="https://docs.payin.com/en/guide/address-pool-setup.html"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-primary hover:underline"
              >
                View how-to guide
              </a>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Supported formats: 1) Simple list (one address per line), 2) HD Wallet CSV (address,derivation_index)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="addresses-input">Addresses</Label>
            <Textarea
              id="addresses-input"
              placeholder={protocol === 'evm'
                ? "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0\n0x5AEDA56215b167893e80B4fE645BA6d5Bab767DE"
                : protocol === 'tron'
                  ? "TYWqRdyeNvW3AJHBvUKzMMnKLq7ctAYtCw\nTXYZoPZKHFahUB3RdyeNvW3AJHBvUKzMM"
                  : "Paste addresses (one per line)"}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="min-h-[240px] font-mono text-sm bg-background text-foreground border-border"
            />
            <p className="text-xs text-muted-foreground">
              {validationResult
                ? `Validation results: ${validationResult.valid} valid, ${validationResult.invalid} invalid, ${validationResult.duplicate} duplicate.`
                : 'Click “Validate” to check addresses before importing.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload CSV
              </Button>
              <Button
                variant="outline"
                onClick={handleValidate}
                disabled={isValidating || !inputText.trim()}
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {isValidating ? 'Validating...' : 'Validate'}
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || !validationResult || validationResult.valid === 0}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {isImporting ? 'Importing...' : `Import ${validationResult?.valid || 0} Addresses`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
