/**
 * ConfigEditDialog Component
 * Dialog for creating or editing configuration values
 */

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';

interface ConfigMetadata {
  key: string;
  display_name: string;
  category: string;
  type: 'number' | 'boolean' | 'string' | 'json' | 'array';
  default_value: any;
  description?: string;
  unit?: string;
  min?: number;
  max?: number;
}

interface ConfigEditDialogProps {
  open: boolean;
  onClose: () => void;
  metadata: ConfigMetadata;
  currentValue?: any;
  organizationId?: string | null;
  scope: 'global' | 'organization';
}

export function ConfigEditDialog({
  open,
  onClose,
  metadata,
  currentValue,
  organizationId,
  scope,
}: ConfigEditDialogProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<any>(currentValue ?? metadata.default_value);
  const [inputValue, setInputValue] = useState<string>('');

  useEffect(() => {
    const val = currentValue ?? metadata.default_value;
    setValue(val);

    // Convert value to string for input field
    if (metadata.type === 'number') {
      setInputValue(String(val ?? ''));
    } else if (metadata.type === 'boolean') {
      // Boolean uses Switch, no need for string conversion
    } else if (metadata.type === 'json' || metadata.type === 'array') {
      setInputValue(val ? JSON.stringify(val, null, 2) : '');
    } else {
      setInputValue(String(val ?? ''));
    }
  }, [currentValue, metadata, open]);

  const updateMutation = useMutation({
    mutationFn: async (data: { key: string; value: any; organization_id?: string | null }) => {
      return api.upsertConfigValue(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-management'] });
      queryClient.invalidateQueries({ queryKey: ['config-values'] });
      queryClient.invalidateQueries({ queryKey: ['config-metadata'] });
      toast.success(`Configuration ${currentValue !== undefined ? 'updated' : 'created'} successfully`);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save configuration');
    },
  });

  const handleSave = () => {
    let parsedValue: any;

    try {
      // Parse value based on type
      if (metadata.type === 'number') {
        parsedValue = Number(inputValue);
        if (isNaN(parsedValue)) {
          toast.error('Invalid number value');
          return;
        }
        // Check min/max constraints
        if (metadata.min !== undefined && parsedValue < metadata.min) {
          toast.error(`Value must be >= ${metadata.min}`);
          return;
        }
        if (metadata.max !== undefined && parsedValue > metadata.max) {
          toast.error(`Value must be <= ${metadata.max}`);
          return;
        }
      } else if (metadata.type === 'boolean') {
        parsedValue = value; // Already a boolean from Switch
      } else if (metadata.type === 'json') {
        parsedValue = JSON.parse(inputValue);
      } else if (metadata.type === 'array') {
        const parsed = JSON.parse(inputValue);
        if (!Array.isArray(parsed)) {
          toast.error('Value must be an array');
          return;
        }
        parsedValue = parsed;
      } else {
        parsedValue = inputValue;
      }

      updateMutation.mutate({
        key: metadata.key,
        value: parsedValue,
        organization_id: scope === 'global' ? null : organizationId,
      });
    } catch (error: any) {
      toast.error(`Invalid ${metadata.type} format: ${error.message}`);
    }
  };

  const renderInput = () => {
    if (metadata.type === 'boolean') {
      return (
        <div className="flex items-center space-x-2">
          <Switch
            checked={value}
            onCheckedChange={setValue}
            id="config-value"
          />
          <Label htmlFor="config-value">
            {value ? 'Enabled' : 'Disabled'}
          </Label>
        </div>
      );
    }

    if (metadata.type === 'json' || metadata.type === 'array') {
      return (
        <textarea
          className="w-full min-h-[150px] px-3 py-2 text-sm border rounded-md font-mono"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`Enter ${metadata.type === 'json' ? 'JSON object' : 'JSON array'}...`}
        />
      );
    }

    return (
      <Input
        type={metadata.type === 'number' ? 'number' : 'text'}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={`Enter ${metadata.type}...`}
        step={metadata.type === 'number' ? 'any' : undefined}
        min={metadata.min}
        max={metadata.max}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {currentValue !== undefined ? 'Edit' : 'Create'} Configuration
          </DialogTitle>
          <DialogDescription>
            {scope === 'global' ? 'Set global configuration value' : 'Set organization-level configuration value'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{metadata.display_name}</Label>
            <p className="text-xs text-muted-foreground">{metadata.description}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="config-value">
              Value {metadata.unit && <span className="text-muted-foreground">({metadata.unit})</span>}
            </Label>
            {renderInput()}
            {metadata.type === 'number' && (metadata.min !== undefined || metadata.max !== undefined) && (
              <p className="text-xs text-muted-foreground">
                {metadata.min !== undefined && `Min: ${metadata.min}`}
                {metadata.min !== undefined && metadata.max !== undefined && ' | '}
                {metadata.max !== undefined && `Max: ${metadata.max}`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Current Metadata Default</Label>
            <div className="text-sm font-mono bg-muted px-3 py-2 rounded-md">
              {JSON.stringify(metadata.default_value)}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
