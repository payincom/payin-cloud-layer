import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Copy, Trash2, Check, Eye, EyeOff, Building2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  isActive: boolean;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateApiKeyResult {
  apiKey: string;
  metadata: ApiKey;
}

export default function ApiKeys() {
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResult | null>(null);
  const [showFullKey, setShowFullKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Fetch API keys
  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await api.get('/api-keys');
      return response.data as ApiKey[];
    },
  });

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post('/api-keys', { name });
      return response.data as CreateApiKeyResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreatedKey(data);
      setShowCreateDialog(false);
      setShowKeyDialog(true);
      setNewKeyName('');
      toast.success('API Key created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create API key');
    },
  });

  // Revoke API key mutation
  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await api.delete(`/api-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API Key revoked successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to revoke API key');
    },
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    createMutation.mutate(newKeyName);
  };

  const handleCopyKey = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey.apiKey);
      setCopiedKey(true);
      toast.success('API Key copied to clipboard');
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleRevoke = (key: ApiKey) => {
    if (confirm(`Are you sure you want to revoke "${key.name}"? This action cannot be undone.`)) {
      revokeMutation.mutate(key.id);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-foreground">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for programmatic access to <span className="font-brand">PayIn</span>
          </p>
          {organization && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>Organization: <span className="font-medium text-foreground">{organization.name}</span></span>
              <Badge variant="outline" className="ml-2">{organization.role}</Badge>
            </div>
          )}
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            API keys are scoped to your organization and allow programmatic access without username/password.
            All API keys created here belong to <span className="font-medium">{organization?.name || 'your organization'}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : apiKeys && apiKeys.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium text-foreground">{key.name}</TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-muted rounded text-sm text-foreground">
                        {key.keyPrefix}••••••••
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.isActive ? 'default' : 'secondary'}>
                        {key.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(key.lastUsedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(key.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(key)}
                        disabled={revokeMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No API keys yet</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first API Key
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create API Key</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter a descriptive name for this API key
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="keyName" className="text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                id="keyName"
                placeholder="e.g., Production Server, Development"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="bg-background text-foreground border-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Created Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="max-w-2xl bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">API Key Created Successfully</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Save this key securely - it will only be shown once!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2 font-medium">
                ⚠️ Important: Copy this key now!
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                This is the only time you'll be able to see the full key. If you lose it, you'll need to create a new one.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Your API Key</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={createdKey?.apiKey || ''}
                    readOnly
                    type={showFullKey ? 'text' : 'password'}
                    className="font-mono pr-10 bg-background text-foreground border-input"
                  />
                  <button
                    onClick={() => setShowFullKey(!showFullKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded"
                  >
                    {showFullKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <Button
                  onClick={handleCopyKey}
                  variant={copiedKey ? 'default' : 'outline'}
                >
                  {copiedKey ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Usage Example</label>
              <div className="p-3 bg-slate-950 dark:bg-slate-900 text-slate-100 rounded-lg font-mono text-sm overflow-x-auto border border-slate-800">
                <pre className="text-slate-100">
{`curl https://api.payin.com/api/v1/orders \\
  -H "Authorization: Bearer ${createdKey?.apiKey || 'pk_test_...'}" \\
  -H "Content-Type: application/json"`}
                </pre>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowKeyDialog(false)}>
              I've saved the key securely
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
