/**
 * WebhookSection Component
 * Manages webhook endpoints, logs, and statistics
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Pencil,
  TestTube,
  RefreshCw,
  Webhook,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Send,
  Eye,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';

const AVAILABLE_EVENTS = [
  { value: 'order.created', label: 'Order Created' },
  { value: 'order.completed', label: 'Order Completed' },
  { value: 'order.expired', label: 'Order Expired' },
  { value: 'deposit.completed', label: 'Deposit Completed' },
  { value: 'deposit.confirmed', label: 'Deposit Confirmed' },
];

interface WebhookEndpoint {
  id: string;
  endpoint_name: string;
  endpoint_type: 'webhook' | 'email' | 'telegram';
  is_enabled: boolean;
  config: {
    url?: string;
    secret?: string;
    to?: string[];
    chat_id?: string;
    bot_token?: string;
  };
  subscribed_events: string[];
  max_retries: number;
  timeout_ms: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface WebhookLog {
  id: string;
  endpoint_id: string;
  event_type: string;
  event_id: string;
  business_type: string;
  business_id: string;
  status: 'pending' | 'sending' | 'success' | 'failed' | 'cancelled';
  retry_count: number;
  http_status_code?: number;
  response_time_ms?: number;
  error_message?: string;
  payload?: any;
  created_at: string;
  sent_at?: string;
  completed_at?: string;
}

export function WebhookSection() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null);
  const [deletingEndpoint, setDeletingEndpoint] = useState<string | null>(null);
  const [viewingLog, setViewingLog] = useState<WebhookLog | null>(null);

  // Form state for creating/editing endpoint
  const [formData, setFormData] = useState({
    endpoint_name: '',
    endpoint_type: 'webhook' as 'webhook' | 'email' | 'telegram',
    url: '',
    secret: '',
    subscribed_events: [] as string[],
    max_retries: 5,
    timeout_ms: 30000,
    description: '',
    is_enabled: true,
  });

  // Fetch endpoints
  const { data: endpointsData, isLoading: endpointsLoading } = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: () => api.listWebhookEndpoints(),
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });

  // Fetch logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['webhook-logs'],
    queryFn: () => api.getWebhookLogs({ limit: 50 }),
    enabled: isAuthenticated,
    refetchInterval: 5000,
  });

  // Fetch statistics
  const { data: statsData } = useQuery({
    queryKey: ['webhook-stats'],
    queryFn: () => api.getWebhookStatistics(),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  // Create endpoint mutation
  const createEndpointMutation = useMutation({
    mutationFn: (data: any) => api.createWebhookEndpoint(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook endpoint created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create webhook endpoint');
    },
  });

  // Update endpoint mutation
  const updateEndpointMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      api.updateWebhookEndpoint(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook endpoint updated successfully');
      setEditingEndpoint(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update webhook endpoint');
    },
  });

  // Delete endpoint mutation
  const deleteEndpointMutation = useMutation({
    mutationFn: (id: string) => api.deleteWebhookEndpoint(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook endpoint deleted successfully');
      setDeletingEndpoint(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete webhook endpoint');
    },
  });

  // Test endpoint mutation
  const testEndpointMutation = useMutation({
    mutationFn: (id: string) => api.testWebhookEndpoint(id),
    onSuccess: () => {
      toast.success('Test notification sent successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Test failed');
    },
  });

  // Retry notification mutation
  const retryMutation = useMutation({
    mutationFn: (id: string) => api.retryWebhookNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
      toast.success('Notification retry triggered');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Retry failed');
    },
  });

  const resetForm = () => {
    setFormData({
      endpoint_name: '',
      endpoint_type: 'webhook',
      url: '',
      secret: '',
      subscribed_events: [],
      max_retries: 5,
      timeout_ms: 30000,
      description: '',
      is_enabled: true,
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleOpenEdit = (endpoint: WebhookEndpoint) => {
    setEditingEndpoint(endpoint);
    setFormData({
      endpoint_name: endpoint.endpoint_name,
      endpoint_type: endpoint.endpoint_type,
      url: endpoint.config.url || '',
      secret: endpoint.config.secret || '',
      subscribed_events: endpoint.subscribed_events,
      max_retries: endpoint.max_retries,
      timeout_ms: endpoint.timeout_ms,
      description: endpoint.description || '',
      is_enabled: endpoint.is_enabled,
    });
  };

  const handleSubmit = () => {
    if (formData.endpoint_type === 'webhook') {
      if (!formData.endpoint_name || !formData.url || !formData.secret) {
        toast.error('Please fill in all required fields');
        return;
      }
    }

    if (formData.subscribed_events.length === 0) {
      toast.error('Please select at least one event');
      return;
    }

    const data = {
      endpoint_name: formData.endpoint_name,
      endpoint_type: formData.endpoint_type,
      config: {
        url: formData.url,
        secret: formData.secret,
      },
      subscribed_events: formData.subscribed_events,
      max_retries: formData.max_retries,
      timeout_ms: formData.timeout_ms,
      description: formData.description,
      is_enabled: formData.is_enabled,
    };

    if (editingEndpoint) {
      updateEndpointMutation.mutate({ id: editingEndpoint.id, updates: data });
    } else {
      createEndpointMutation.mutate(data);
    }
  };

  const handleToggleEvent = (eventValue: string) => {
    setFormData(prev => ({
      ...prev,
      subscribed_events: prev.subscribed_events.includes(eventValue)
        ? prev.subscribed_events.filter(e => e !== eventValue)
        : [...prev.subscribed_events, eventValue],
    }));
  };

  const handleToggleEnabled = async (endpoint: WebhookEndpoint) => {
    try {
      await updateEndpointMutation.mutateAsync({
        id: endpoint.id,
        updates: { is_enabled: !endpoint.is_enabled },
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const endpoints = endpointsData?.endpoints || [];
  const logs = logsData?.logs || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-500"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'sending':
        return <Badge className="bg-blue-500/10 text-blue-500"><Send className="w-3 h-3 mr-1" />Sending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="endpoints" className="w-full">
        <TabsList>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="logs">Notification Logs</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        {/* Endpoints Tab */}
        <TabsContent value="endpoints" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="w-5 h-5" />
                    Webhook Endpoints
                  </CardTitle>
                  <CardDescription>
                    Manage webhook URLs and event subscriptions
                  </CardDescription>
                </div>
                <Button onClick={handleOpenCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Endpoint
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {endpointsLoading ? (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead>Name</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[1, 2, 3].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : endpoints.length === 0 ? (
                <div className="p-12 text-center">
                  <Webhook className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No webhook endpoints configured</p>
                  <Button onClick={handleOpenCreate} variant="outline" className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Endpoint
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead>Name</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endpoints.map((endpoint: WebhookEndpoint) => (
                      <TableRow key={endpoint.id} className="border-border hover:bg-accent/50">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{endpoint.endpoint_name}</span>
                            {endpoint.description && (
                              <span className="text-xs text-muted-foreground">{endpoint.description}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{endpoint.config.url}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {endpoint.subscribed_events.slice(0, 2).map((event) => (
                              <Badge key={event} variant="outline" className="text-xs">
                                {event}
                              </Badge>
                            ))}
                            {endpoint.subscribed_events.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{endpoint.subscribed_events.length - 2} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={endpoint.is_enabled}
                              onCheckedChange={() => handleToggleEnabled(endpoint)}
                            />
                            <span className="text-sm">
                              {endpoint.is_enabled ? (
                                <span className="text-green-500">Enabled</span>
                              ) : (
                                <span className="text-muted-foreground">Disabled</span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => testEndpointMutation.mutate(endpoint.id)}
                              disabled={!endpoint.is_enabled || testEndpointMutation.isPending}
                            >
                              <TestTube className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(endpoint)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingEndpoint(endpoint.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Logs</CardTitle>
              <CardDescription>
                View webhook delivery history and responses
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="p-6">
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : logs.length === 0 ? (
                <div className="p-12 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No notification logs yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border">
                      <TableHead>Event</TableHead>
                      <TableHead>Business Reference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: WebhookLog) => (
                      <TableRow key={log.id} className="border-border hover:bg-accent/50">
                        <TableCell>
                          <Badge variant="outline">{log.event_type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {(() => {
                            if (log.business_type === 'deposit') {
                              return log.payload?.data?.depositReference || log.payload?.depositReference || log.business_id || '-';
                            } else if (log.business_type === 'order') {
                              return log.payload?.data?.orderReference || log.payload?.orderReference || log.business_id || '-';
                            }
                            return log.business_id || '-';
                          })()}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingLog(log)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {log.status === 'failed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => retryMutation.mutate(log.id)}
                                disabled={retryMutation.isPending}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-4 mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData?.total_sent || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {statsData?.total_sent > 0
                    ? `${((statsData.total_success / statsData.total_sent) * 100).toFixed(1)}%`
                    : '0%'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{statsData?.total_failed || 0}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen || editingEndpoint !== null} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setEditingEndpoint(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEndpoint ? 'Edit Webhook Endpoint' : 'Create Webhook Endpoint'}
            </DialogTitle>
            <DialogDescription>
              Configure a webhook endpoint to receive notifications
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint_name" className="text-foreground">Endpoint Name *</Label>
              <Input
                id="endpoint_name"
                placeholder="My Webhook"
                value={formData.endpoint_name}
                onChange={(e) => setFormData({ ...formData, endpoint_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url" className="text-foreground">Webhook URL *</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/webhook"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secret" className="text-foreground">Secret Key *</Label>
              <Input
                id="secret"
                type="password"
                placeholder="Enter a secure secret key"
                value={formData.secret}
                onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Used to sign webhook requests. Keep this secret safe.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Subscribed Events *</Label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_EVENTS.map((event) => (
                  <div key={event.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={event.value}
                      checked={formData.subscribed_events.includes(event.value)}
                      onChange={() => handleToggleEvent(event.value)}
                      className="w-4 h-4 rounded border-input bg-background"
                    />
                    <label htmlFor={event.value} className="text-sm cursor-pointer text-foreground">
                      {event.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_retries" className="text-foreground">Max Retries</Label>
                <Input
                  id="max_retries"
                  type="number"
                  min="0"
                  max="10"
                  value={formData.max_retries}
                  onChange={(e) => setFormData({ ...formData, max_retries: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout_ms" className="text-foreground">Timeout (ms)</Label>
                <Input
                  id="timeout_ms"
                  type="number"
                  min="1000"
                  max="60000"
                  value={formData.timeout_ms}
                  onChange={(e) => setFormData({ ...formData, timeout_ms: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_enabled"
                checked={formData.is_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
              />
              <Label htmlFor="is_enabled" className="text-foreground">Enable endpoint</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingEndpoint(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createEndpointMutation.isPending || updateEndpointMutation.isPending}
            >
              {editingEndpoint ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deletingEndpoint !== null} onOpenChange={(open) => !open && setDeletingEndpoint(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook Endpoint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webhook endpoint? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEndpoint && deleteEndpointMutation.mutate(deletingEndpoint)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Log Detail Dialog */}
      <Dialog open={viewingLog !== null} onOpenChange={(open) => !open && setViewingLog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notification Log Details</DialogTitle>
          </DialogHeader>

          {viewingLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Event Type</p>
                  <p className="font-medium text-foreground">{viewingLog.event_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(viewingLog.status)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Business Type</p>
                  <p className="font-medium text-foreground capitalize">{viewingLog.business_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{viewingLog.business_type === 'order' ? 'Order Reference' : 'Deposit Reference'}</p>
                  <p className="font-mono text-xs text-foreground">
                    {(() => {
                      if (viewingLog.business_type === 'deposit') {
                        return viewingLog.payload?.data?.depositReference || viewingLog.payload?.depositReference || viewingLog.business_id || '-';
                      } else if (viewingLog.business_type === 'order') {
                        return viewingLog.payload?.data?.orderReference || viewingLog.payload?.orderReference || viewingLog.business_id || '-';
                      }
                      return viewingLog.business_id || '-';
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Retry Count</p>
                  <p className="font-medium text-foreground">{viewingLog.retry_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">HTTP Status</p>
                  <p className="font-medium text-foreground">{viewingLog.http_status_code || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Response Time</p>
                  <p className="font-medium text-foreground">{viewingLog.response_time_ms ? `${viewingLog.response_time_ms}ms` : 'N/A'}</p>
                </div>
              </div>

              {viewingLog.error_message && (
                <div>
                  <p className="text-muted-foreground text-sm mb-2">Error Message</p>
                  <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
                    {viewingLog.error_message}
                  </div>
                </div>
              )}

              {viewingLog.payload && (
                <div>
                  <p className="text-muted-foreground text-sm mb-2">Webhook Payload</p>
                  <div className="bg-muted/50 p-3 rounded">
                    <pre className="text-xs font-mono text-foreground overflow-x-auto">
                      {JSON.stringify(viewingLog.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div>
                <p className="text-muted-foreground text-sm mb-2">Timestamps</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-foreground">Created:</span>
                    <span className="font-mono text-foreground">{new Date(viewingLog.created_at).toLocaleString()}</span>
                  </div>
                  {viewingLog.sent_at && (
                    <div className="flex justify-between">
                      <span className="text-foreground">Sent:</span>
                      <span className="font-mono text-foreground">{new Date(viewingLog.sent_at).toLocaleString()}</span>
                    </div>
                  )}
                  {viewingLog.completed_at && (
                    <div className="flex justify-between">
                      <span className="text-foreground">Completed:</span>
                      <span className="font-mono text-foreground">{new Date(viewingLog.completed_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingLog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
