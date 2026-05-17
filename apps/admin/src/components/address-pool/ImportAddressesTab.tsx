import { useState } from 'react';
import { Upload, FileJson, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface ImportAddressesTabProps {
  protocols: Array<{
    protocol: string;
    displayName: string;
  }>;
}

interface ValidationResult {
  valid: number;
  invalid: number;
  duplicate: number;
  addresses: Array<{
    address: string;
    status: 'valid' | 'invalid' | 'duplicate';
    error?: string;
  }>;
}

/**
 * Import Addresses Tab Component
 * Allows importing addresses via file upload or text paste
 */
export function ImportAddressesTab({ protocols }: ImportAddressesTabProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<string>(protocols[0]?.protocol || 'evm');
  const [importMethod, setImportMethod] = useState<'file' | 'paste'>('file');
  const [pastedAddresses, setPastedAddresses] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate JSON structure
      if (!Array.isArray(data)) {
        toast.error('Invalid file format. Expected an array of addresses.');
        return;
      }

      // Extract addresses from JSON
      const addresses = data.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item.address) return item.address;
        return null;
      }).filter(Boolean);

      setPastedAddresses(addresses.join('\n'));
      toast.success(`Loaded ${addresses.length} addresses from file`);
    } catch (error) {
      toast.error('Failed to parse JSON file. Please check the format.');
    }
  };

  const handleValidate = () => {
    const addresses = pastedAddresses
      .split('\n')
      .map(addr => addr.trim())
      .filter(Boolean);

    if (addresses.length === 0) {
      toast.error('Please enter at least one address');
      return;
    }

    setIsValidating(true);

    // Simple validation logic (can be enhanced)
    const seen = new Set<string>();
    const validated = addresses.map(address => {
      // Check for duplicates
      if (seen.has(address.toLowerCase())) {
        return { address, status: 'duplicate' as const };
      }
      seen.add(address.toLowerCase());

      // Basic format validation
      if (selectedProtocol === 'evm') {
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
          return {
            address,
            status: 'invalid' as const,
            error: 'Invalid EVM address format'
          };
        }
      } else if (selectedProtocol === 'tron') {
        if (!/^T[a-zA-Z0-9]{33}$/.test(address)) {
          return {
            address,
            status: 'invalid' as const,
            error: 'Invalid Tron address format'
          };
        }
      } else if (selectedProtocol === 'solana') {
        if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
          return {
            address,
            status: 'invalid' as const,
            error: 'Invalid Solana address format'
          };
        }
      }

      return { address, status: 'valid' as const };
    });

    const result: ValidationResult = {
      valid: validated.filter(v => v.status === 'valid').length,
      invalid: validated.filter(v => v.status === 'invalid').length,
      duplicate: validated.filter(v => v.status === 'duplicate').length,
      addresses: validated,
    };

    setValidationResult(result);
    setIsValidating(false);

    toast.success('Validation complete');
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
        .map((v, index) => ({
          address: v.address,
          protocol: selectedProtocol,
          derivationIndex: index, // Placeholder - should be managed properly
          masterPublicKey: null,
        }));

      await api.addAddressesToPool(validAddresses);

      toast.success(`Successfully imported ${validAddresses.length} addresses`);

      // Reset form
      setPastedAddresses('');
      setValidationResult(null);
    } catch (error) {
      toast.error('Failed to import addresses');
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadSample = () => {
    const sample = [
      { address: '0x1234567890123456789012345678901234567890' },
      { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
    ];

    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-addresses.json';
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Sample file downloaded');
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Select Protocol */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Step 1: Select Protocol</h3>
        <RadioGroup value={selectedProtocol} onValueChange={setSelectedProtocol}>
          <div className="flex flex-wrap gap-4">
            {protocols.map((p) => (
              <div key={p.protocol} className="flex items-center space-x-2">
                <RadioGroupItem value={p.protocol} id={`protocol-${p.protocol}`} />
                <Label htmlFor={`protocol-${p.protocol}`} className="cursor-pointer">
                  {p.displayName}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Step 2: Import Method */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Step 2: Import Method</h3>
        <RadioGroup value={importMethod} onValueChange={(v) => setImportMethod(v as 'file' | 'paste')}>
          <div className="space-y-4">
            {/* File Upload */}
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="file" id="method-file" className="mt-1" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="method-file" className="cursor-pointer">
                  Upload JSON File
                </Label>
                {importMethod === 'file' && (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-muted/30">
                    <FileJson className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90"
                    >
                      <Upload className="h-4 w-4" />
                      Choose File
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">
                      or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Format: <code>[{`{"address": "0x..."}`}, ...]</code>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Paste Addresses */}
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="paste" id="method-paste" className="mt-1" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="method-paste" className="cursor-pointer">
                  Paste Addresses (one per line)
                </Label>
                {importMethod === 'paste' && (
                  <Textarea
                    placeholder="0x1234567890123456789012345678901234567890&#10;0xabcdefabcdefabcdefabcdefabcdefabcdefabcd&#10;..."
                    value={pastedAddresses}
                    onChange={(e) => setPastedAddresses(e.target.value)}
                    className="min-h-[200px] font-mono text-sm bg-background text-foreground"
                  />
                )}
              </div>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Step 3: Validation */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Step 3: Validation</h3>
        {validationResult ? (
          <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Valid: {validationResult.valid}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Invalid: {validationResult.invalid}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Duplicate: {validationResult.duplicate}</span>
              </div>
            </div>

            {/* Show validation details if there are issues */}
            {(validationResult.invalid > 0 || validationResult.duplicate > 0) && (
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {validationResult.addresses
                  .filter(v => v.status !== 'valid')
                  .map((v, i) => (
                    <div key={i} className="text-xs font-mono flex items-center gap-2">
                      {v.status === 'invalid' && <XCircle className="h-3 w-3 text-red-500" />}
                      {v.status === 'duplicate' && <AlertCircle className="h-3 w-3 text-yellow-500" />}
                      <span className="text-muted-foreground">{v.address}</span>
                      {v.error && <span className="text-red-500">- {v.error}</span>}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div className="border border-border rounded-lg p-4 bg-muted/30 text-center text-sm text-muted-foreground">
            Click "Validate" to check addresses
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleDownloadSample}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download Sample
        </Button>
        <Button
          variant="outline"
          onClick={handleValidate}
          disabled={isValidating || !pastedAddresses.trim()}
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
  );
}
