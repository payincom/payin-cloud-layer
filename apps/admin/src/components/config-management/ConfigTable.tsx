/**
 * ConfigTable Component
 * Displays a table of configuration values with edit/delete actions
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
import { ConfigInheritanceBadge } from './ConfigInheritanceBadge';
import { ConfigEditDialog } from './ConfigEditDialog';
import { api } from '@/lib/api';

interface ConfigMetadataItem {
  key: string;
  display_name: string;
  type: 'number' | 'boolean' | 'string' | 'json' | 'array';
  default_value: any;
  category: string;
  description?: string;
  unit?: string;
  min?: number;
  max?: number;
  global_only?: boolean; // If true, can only be configured at global level
}

interface ConfigValue {
  key: string;
  value: any;
  organization_id: string | null;
  effective_value?: any;
  effective_source?: 'global' | 'organization' | 'metadata';
  global_value?: any;
  organization_value?: any;
  metadata?: ConfigMetadataItem;
}

interface ConfigTableProps {
  configs: ConfigValue[];
  metadata: ConfigMetadataItem[];
  organizationId?: string | null;
  scope: 'global' | 'organization';
  canEdit: boolean;
  showInheritance?: boolean;
}

export function ConfigTable({
  configs,
  metadata,
  organizationId,
  scope,
  canEdit,
  showInheritance = false,
}: ConfigTableProps) {
  const queryClient = useQueryClient();
  const [editingConfig, setEditingConfig] = useState<ConfigValue | null>(null);
  const [deletingConfig, setDeletingConfig] = useState<ConfigValue | null>(null);

  // Create a map of metadata for quick lookup
  const metadataMap = new Map(metadata.map(m => [m.key, m]));

  // Merge configs with metadata
  const enrichedConfigs: ConfigValue[] = configs.map(config => ({
    ...config,
    metadata: metadataMap.get(config.key),
  }));

  // Get missing configs (metadata without values)
  const existingKeys = new Set(configs.map(c => c.key));
  const missingConfigs: ConfigValue[] = metadata
    .filter(m => !existingKeys.has(m.key))
    .map(m => ({
      key: m.key,
      value: undefined,
      organization_id: null,
      metadata: m,
      effective_value: m.default_value,
      effective_source: 'metadata' as const,
    }));

  // Filter out globalOnly configs when in organization scope
  const allConfigs = [...enrichedConfigs, ...missingConfigs].filter(config => {
    // If scope is organization and config is globalOnly, filter it out
    if (scope === 'organization' && config.metadata?.global_only === true) {
      return false;
    }
    return true;
  });

  const deleteMutation = useMutation({
    mutationFn: async (data: { key: string; organizationId?: string }) => {
      return api.deleteConfigValue(data.key, data.organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-management'] });
      queryClient.invalidateQueries({ queryKey: ['config-values'] });
      toast.success('Configuration deleted successfully');
      setDeletingConfig(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete configuration');
    },
  });

  const handleDelete = (config: ConfigValue) => {
    deleteMutation.mutate({
      key: config.key,
      organizationId: scope === 'organization' ? organizationId || undefined : undefined,
    });
  };

  const handleEdit = (config: ConfigValue) => {
    setEditingConfig(config);
  };

  const handleCreate = (key: string) => {
    const meta = metadataMap.get(key);
    if (meta) {
      setEditingConfig({
        key,
        value: undefined,
        organization_id: null,
        metadata: meta,
      });
    }
  };

  const formatValue = (value: any, type: string) => {
    if (value === undefined || value === null) {
      return <span className="text-muted-foreground italic">Not set</span>;
    }

    if (type === 'boolean') {
      return (
        <Badge variant={value ? 'default' : 'outline'}>
          {value ? 'Enabled' : 'Disabled'}
        </Badge>
      );
    }

    if (type === 'json' || type === 'array') {
      return (
        <code className="text-xs bg-muted px-2 py-1 rounded">
          {JSON.stringify(value)}
        </code>
      );
    }

    return <span className="font-mono text-sm">{String(value)}</span>;
  };

  // Group configs by key prefix for better organization
  const getGroupName = (key: string): string => {
    if (key.startsWith('orders.')) return 'Orders';
    if (key.startsWith('address_pool.')) return 'Address Pool';
    if (key.startsWith('services.')) return 'Services';
    if (key.startsWith('redirect.')) return 'Redirects';
    if (key.startsWith('delayed_confirmation.')) return 'System';
    return 'Other';
  };

  const groupedConfigs = allConfigs.reduce((acc, config) => {
    const groupName = getGroupName(config.key);
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(config);
    return acc;
  }, {} as Record<string, typeof allConfigs>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedConfigs).map(([category, categoryConfigs]) => (
        <div key={category} className="space-y-2">
          <h3 className="text-lg font-semibold">{category}</h3>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Configuration</TableHead>
                  <TableHead>Value</TableHead>
                  {showInheritance && <TableHead>Source</TableHead>}
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryConfigs.map(config => {
                  const displayValue = showInheritance ? config.effective_value : config.value;
                  const hasDisplayValue = displayValue !== undefined && displayValue !== null;
                  const hasScopeValue =
                    scope === 'organization'
                      ? config.organization_value !== undefined && config.organization_value !== null
                      : config.value !== undefined && config.value !== null;

                  return (
                    <TableRow key={config.key}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{config.metadata?.display_name || config.key}</div>
                          {config.metadata?.description && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {config.metadata.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {formatValue(displayValue, config.metadata?.type || 'string')}
                          {config.metadata?.unit && hasDisplayValue && (
                            <span className="text-xs text-muted-foreground ml-1">
                              {config.metadata.unit}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {showInheritance && (
                        <TableCell>
                          {config.effective_source && (
                            <ConfigInheritanceBadge source={config.effective_source} />
                          )}
                        </TableCell>
                      )}
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {hasScopeValue ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(config)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingConfig(config)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreate(config.key)}
                              >
                                Set Value
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {/* Edit/Create Dialog */}
      {editingConfig && editingConfig.metadata && (
        <ConfigEditDialog
          open={true}
          onClose={() => {
            setEditingConfig(null);
          }}
          metadata={editingConfig.metadata}
          currentValue={editingConfig.value}
          organizationId={organizationId}
          scope={scope}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingConfig} onOpenChange={() => setDeletingConfig(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this configuration?
              {scope === 'organization' && (
                <span className="block mt-2">
                  The configuration will fall back to the global value or metadata default.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingConfig && handleDelete(deletingConfig)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
