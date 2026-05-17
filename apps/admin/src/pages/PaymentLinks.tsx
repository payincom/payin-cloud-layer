import { useEffect, useMemo, useState, useRef, forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ClipboardCopy, Eye, Pencil, Plus, RefreshCw, Search, X, Globe, EyeOff, Archive, ArchiveRestore, Monitor, Smartphone, MoreVertical, List, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { renderPaymentLinkCheckoutPageBrowser } from '@payin/shared/checkout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PaymentLinkOrdersModal } from '@/components/payment-links/PaymentLinkOrdersModal';
import { AddressPoolSetupGuide } from '@/components/address-pool/AddressPoolSetupGuide';
import { useAddressPoolStatus } from '@/hooks/useAddressPoolStatus';
import { EmptyState } from '@/components/shared/EmptyState';

const FullscreenDialogContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn('fixed inset-0 z-50 flex flex-col bg-background text-foreground focus:outline-none', className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
FullscreenDialogContent.displayName = 'FullscreenDialogContent';

type PaymentLinkStatus = 'draft' | 'published';

interface PaymentLinkCurrency {
  id?: string;
  currency: string;
  chain_options: string[];
  amount?: string | null;
  is_primary: boolean;
}

interface PaymentLink {
  id: string;
  organization_id: string;
  title: string;
  description?: string | null;
  amount: string;
  currency?: string | null; // Legacy field for backward compatibility
  status: PaymentLinkStatus;
  is_archived: boolean;
  slug?: string | null;
  chain_options?: string[] | null; // Legacy field for backward compatibility
  currencies: PaymentLinkCurrency[];
  inventory_total?: number | null;
  inventory_reserved: number;
  inventory_sold: number;
  metadata?: Record<string, any> | null;
  expires_at?: string | null;
  published_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  amount_type: 'fixed' | 'user_input';
  cta_text?: string | null;
  theme: 'dark' | 'light';
}

interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  chains?: Array<{
    chainId: string;
    contractAddress: string;
  }>;
}

interface CurrencyFormConfig {
  currency: string;
  chain_options: string[];
  amount?: string;
  is_primary: boolean;
}

const STATUS_BADGE_STYLES: Record<PaymentLinkStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-green-500/10 text-green-500',
};

const STATUS_LABELS: Record<PaymentLinkStatus, string> = {
  draft: 'Draft',
  published: 'Published',
};

const STATUS_FILTERS: Array<{ value: 'all' | PaymentLinkStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
];

const formatChainName = (chainId: string) =>
  chainId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatAmount = (amount: string, currency: string) =>
  `${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${currency}`;

export default function PaymentLinks() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentLinkStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<PaymentLink | null>(null);
  const [ordersModalLink, setOrdersModalLink] = useState<PaymentLink | null>(null);
  const [isCurrencyManagerOpen, setIsCurrencyManagerOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    amount: '',
    inventoryTotal: '',
    currencies: [] as CurrencyFormConfig[],
    amountType: 'fixed' as 'fixed' | 'user_input',
    ctaText: '',
    theme: 'dark' as 'dark' | 'light',
  });
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewUrlLoading, setPreviewUrlLoading] = useState(false);
  const [inlinePreviewHtml, setInlinePreviewHtml] = useState('');
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);

  const {
    isLoading: poolSummaryLoading,
    isError: poolSummaryError,
    hasAnyAddresses,
  } = useAddressPoolStatus();

  const shouldFetchPaymentLinks = !poolSummaryLoading && (poolSummaryError || hasAnyAddresses);

  const { data: paymentLinksResponse, isLoading } = useQuery({
    queryKey: ['payment-links', activeTab, statusFilter, debouncedSearch],
    queryFn: () => {
      const params: Record<string, any> = {
        search: debouncedSearch || undefined,
        limit: 200,
      };

      if (activeTab === 'active') {
        if (statusFilter !== 'all') {
          params.status = statusFilter;
        }
      } else {
        params.includeArchived = true;
        params.archived = true;
      }

      return api.listPaymentLinks(params);
    },
    refetchInterval: 10000,
    enabled: shouldFetchPaymentLinks,
  });

  const { data: tokensResponse } = useQuery({
    queryKey: ['tokens'],
    queryFn: () => api.listTokens(),
    staleTime: 60 * 1000,
    enabled: shouldFetchPaymentLinks,
  });

  // Public base URL for generating share URLs
  // Use API server URL (not Admin URL) for payment link checkout pages
  const apiServerUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1')
    .replace(/\/api\/v1$/, '');
  const publicBaseUrl =
    (import.meta.env.VITE_PAYMENT_LINK_PUBLIC_URL as string | undefined) ||
    apiServerUrl;

  // Fetch preview URL when editing a link or when preview mode changes
  useEffect(() => {
    if (!editingLink?.id) {
      setPreviewUrl('');
      return;
    }

    const fetchPreviewUrl = async () => {
      setPreviewUrlLoading(true);
      try {
        const response: any = await api.createPaymentLinkPreviewUrl(editingLink.id);
        if (response.success && response.data?.url) {
          // Append viewport parameter to the URL
          const url = new URL(response.data.url);
          url.searchParams.set('viewport', previewMode);
          setPreviewUrl(url.toString());
        }
      } catch (error) {
        console.error('Failed to fetch preview URL:', error);
        toast.error('Failed to load preview');
        setPreviewUrl('');
      } finally {
        setPreviewUrlLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [editingLink?.id, previewMode]);

  // Send preview updates to iframe when form changes
  useEffect(() => {
    if (!previewIframeRef.current?.contentWindow || !previewUrl) {
      return;
    }

    const sendUpdate = () => {
      const payload = {
        type: 'PREVIEW_UPDATE',
        payload: {
          title: createForm.title,
          description: createForm.description,
          amount: createForm.amount,
          currencies: createForm.currencies,
          amountType: createForm.amountType,
          ctaText: createForm.ctaText,
          theme: createForm.theme,
        },
      };
      previewIframeRef.current?.contentWindow?.postMessage(payload, '*');
    };

    // Send immediately if iframe is already loaded
    const timer = setTimeout(sendUpdate, 100);

    // Also listen for iframe load event to send initial data
    const iframe = previewIframeRef.current;
    const handleLoad = () => {
      setTimeout(sendUpdate, 50);
    };
    iframe?.addEventListener('load', handleLoad);

    return () => {
      clearTimeout(timer);
      iframe?.removeEventListener('load', handleLoad);
    };
  }, [createForm.title, createForm.description, createForm.amount, createForm.amountType, createForm.ctaText, createForm.theme, JSON.stringify(createForm.currencies), previewUrl]);

  // Real-time preview for CREATE mode (when there's no editingLink)
  useEffect(() => {
    // Only render preview in CREATE mode (not editing existing link)
    if (editingLink?.id || !isCreateOpen) {
      return;
    }

    // Render preview HTML using browser renderer
    const renderPreview = () => {
      try {
        const htmlString = renderPaymentLinkCheckoutPageBrowser(
          {
            title: createForm.title || 'Untitled',
            description: createForm.description || null,
            slug: null,
            defaultAmount: createForm.amount || '0',
            amountType: createForm.amountType,
            ctaText: createForm.ctaText || null,
            theme: createForm.theme,
            currencies: createForm.currencies.map((curr) => ({
              currency: curr.currency,
              chains: curr.chain_options || [],
              amount: curr.amount || createForm.amount || '0',
              isPrimary: curr.is_primary,
            })),
            shareUrl: null,
            inventoryTotal: null,
            inventoryReserved: null,
            inventorySold: null,
          },
          {
            mode: 'preview',
            previewViewport: previewMode,
            requestOrigin: window.location.origin,
            apiBaseUrl: apiServerUrl,
            orderBaseUrl: `${apiServerUrl}/pay/order`,
          },
        );

        setInlinePreviewHtml(htmlString);
      } catch (error) {
        console.error('Failed to render preview:', error);
      }
    };

    // Debounce rendering to avoid too many updates
    const timer = setTimeout(renderPreview, 150);

    return () => clearTimeout(timer);
  }, [
    createForm.title,
    createForm.description,
    createForm.amount,
    createForm.inventoryTotal,
    createForm.amountType,
    createForm.ctaText,
    createForm.theme,
    JSON.stringify(createForm.currencies),
    previewMode,
    editingLink?.id,
    isCreateOpen,
    apiServerUrl,
  ]);

  const openPreviewWindow = () => {
    if (!previewUrl || typeof window === 'undefined') {
      return;
    }

    window.open(previewUrl, '_blank', 'noopener');
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (activeTab === 'archived') {
      setStatusFilter('all');
    }
  }, [activeTab]);

  const rawTokens = (tokensResponse as any)?.tokens;
  const tokens: TokenInfo[] = Array.isArray(rawTokens) ? rawTokens : [];

  const currencyOptions = useMemo(() => {
    const map = new Map<string, TokenInfo>();
    tokens.forEach((token) => map.set(token.symbol, token));
    return Array.from(map.values());
  }, [tokens]);

  const chainOptionsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    currencyOptions.forEach((token) => {
      map.set(
        token.symbol,
        token.chains?.map((chain) => chain.chainId) ?? [],
      );
    });
    return map;
  }, [currencyOptions]);

  const paymentLinksData = (paymentLinksResponse as any)?.data;
  const paymentLinks: PaymentLink[] = Array.isArray(paymentLinksData) ? paymentLinksData : [];

  // Note: allOrders query removed - stats now come directly from API via statsResponse

  // Calculate statistics
  // Use stats from API instead of calculating locally
  const createPaymentLink = useMutation({
    mutationFn: (payload: {
      title: string;
      description?: string | null;
      amount: string;
      currencies: Array<{
        currency: string;
        chainOptions: string[];
        amount?: string | null;
        isPrimary: boolean;
      }>;
      inventoryTotal?: number | null;
      amountType?: 'fixed' | 'user_input';
      ctaText?: string | null;
      theme?: 'dark' | 'light';
    }) => api.createPaymentLink(payload),
    onSuccess: () => {
      toast.success('Payment Link created');
      setIsCreateOpen(false);
      setEditingLink(null);
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create payment link');
    },
  });

  const updatePaymentLink = useMutation({
    mutationFn: (payload: {
      id: string;
      updates: {
        title?: string;
        description?: string | null;
        amount?: string;
        inventoryTotal?: number | null;
        amountType?: 'fixed' | 'user_input';
        ctaText?: string | null;
        theme?: 'dark' | 'light';
      };
    }) => api.updatePaymentLink(payload.id, payload.updates),
    onSuccess: (response) => {
      toast.success('Payment Link updated');
      setIsCreateOpen(false);
      setEditingLink(null);
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
      if (response?.data) {
        queryClient.invalidateQueries({ queryKey: ['payment-link-preview-url', response.data.id] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update payment link');
    },
  });

  const updatePaymentLinkCurrencies = useMutation({
    mutationFn: (payload: {
      id: string;
      currencies: Array<{
        currency: string;
        chainOptions: string[];
        amount?: string | null;
        isPrimary: boolean;
      }>;
    }) => api.updatePaymentLinkCurrencies(payload.id, payload.currencies),
    onSuccess: (response) => {
      toast.success('Currencies updated');
      setIsCurrencyManagerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
      if (response?.data) {
        queryClient.invalidateQueries({ queryKey: ['payment-link-preview-url', response.data.id] });
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update currencies');
    },
  });

  const publishPaymentLink = useMutation({
    mutationFn: ({ id }: { id: string }) => api.publishPaymentLink(id),
    onSuccess: () => {
      toast.success('Payment Link published');
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to publish payment link');
    },
  });

  const unpublishPaymentLinkMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => api.unpublishPaymentLink(id),
    onSuccess: () => {
      toast.success('Payment Link unpublished');
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to unpublish payment link');
    },
  });

  const archivePaymentLinkMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PaymentLinkStatus }) => {
      // Best practice: Unpublish before archiving if published
      if (status === 'published') {
        await api.unpublishPaymentLink(id);
      }
      return api.archivePaymentLink(id);
    },
    onSuccess: (_, variables) => {
      if (variables.status === 'published') {
        toast.success('Payment Link unpublished and archived');
      } else {
        toast.success('Payment Link archived');
      }
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to archive payment link');
    },
  });

  const restorePaymentLinkMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => api.restorePaymentLink(id),
    onSuccess: () => {
      toast.success('Payment Link restored to draft', {
        description: 'Click Publish to make it available again',
      });
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to restore payment link');
    },
  });


  const resetCreateForm = (link?: PaymentLink | null) => {
    if (link) {
      // Ensure we have at least one currency with is_primary set
      let currencies = link.currencies && link.currencies.length > 0
        ? link.currencies.map(c => ({
            currency: c.currency,
            chain_options: [...c.chain_options],
            amount: c.amount ?? '',
            is_primary: c.is_primary,
          }))
        : [];

      // If no currencies or no primary set, add a default one
      if (currencies.length === 0) {
        const defaultCurrency = currencyOptions[0]?.symbol ?? 'USDC';
        const defaultChains = chainOptionsMap.get(defaultCurrency) ?? [];
        currencies = [{
          currency: defaultCurrency,
          chain_options: [...defaultChains],
          amount: '',
          is_primary: true,
        }];
      } else if (!currencies.some(c => c.is_primary)) {
        // Ensure at least one currency is marked as primary
        currencies[0].is_primary = true;
      }

      setCreateForm({
        title: link.title,
        description: link.description ?? '',
        amount: link.amount,
        inventoryTotal: link.inventory_total != null ? String(link.inventory_total) : '',
        currencies,
        amountType: link.amount_type || 'fixed',
        ctaText: link.cta_text ?? '',
        theme: link.theme || 'dark',
      });
      return;
    }

    // Default: add one USDC currency config
    const defaultCurrency = currencyOptions[0]?.symbol ?? 'USDC';
    const defaultChains = chainOptionsMap.get(defaultCurrency) ?? [];
    setCreateForm({
      title: '',
      description: '',
      amount: '',
      inventoryTotal: '',
      currencies: [{
        currency: defaultCurrency,
        chain_options: [...defaultChains],
        amount: '',
        is_primary: true,
      }],
      amountType: 'fixed',
      ctaText: '',
      theme: 'dark',
    });
  };

  const handleCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    // Only validate amount for fixed type
    if (createForm.amountType === 'fixed' && (!createForm.amount || Number(createForm.amount) <= 0)) {
      toast.error('Amount must be greater than 0 for fixed amount type');
      return;
    }
    if (createForm.currencies.length === 0) {
      toast.error('Add at least one currency');
      return;
    }

    // Validate currencies
    for (const curr of createForm.currencies) {
      if (!curr.currency) {
        toast.error('Currency is required for all currency configs');
        return;
      }
      if (curr.chain_options.length === 0) {
        toast.error(`Select at least one chain for ${curr.currency}`);
        return;
      }
    }

    const primaryCount = createForm.currencies.filter(c => c.is_primary).length;
    if (primaryCount === 0) {
      toast.error('Mark at least one currency as primary');
      return;
    }
    if (primaryCount > 1) {
      toast.error('Only one currency can be primary');
      return;
    }

    const payload = {
      title: createForm.title.trim(),
      description: createForm.description.trim() || null,
      // For user_input type, use 0 as placeholder amount (will be overridden by user)
      amount: createForm.amountType === 'user_input' ? '0' : createForm.amount,
      currencies: createForm.currencies.map(c => ({
        currency: c.currency,
        chainOptions: c.chain_options,
        amount: c.amount || null,
        isPrimary: c.is_primary,
      })),
      inventoryTotal: createForm.inventoryTotal ? Number(createForm.inventoryTotal) : null,
      amountType: createForm.amountType,
      ctaText: createForm.ctaText.trim() || null,
      theme: createForm.theme,
    };

    if (editingLink) {
      updatePaymentLink.mutate({
        id: editingLink.id,
        updates: {
          title: payload.title,
          description: payload.description,
          amount: payload.amount,
          inventoryTotal: payload.inventoryTotal,
          amountType: payload.amountType,
          ctaText: payload.ctaText,
          theme: payload.theme,
        },
      });
      // Update currencies separately
      updatePaymentLinkCurrencies.mutate({
        id: editingLink.id,
        currencies: payload.currencies,
      });
    } else {
      createPaymentLink.mutate(payload);
    }
  };

  const addCurrency = () => {
    const availableCurrencies = currencyOptions.filter(
      token => !createForm.currencies.some(c => c.currency === token.symbol)
    );

    if (availableCurrencies.length === 0) {
      toast.error('All available currencies have been added');
      return;
    }

    const newCurrency = availableCurrencies[0].symbol;
    const newChains = chainOptionsMap.get(newCurrency) ?? [];

    setCreateForm(prev => ({
      ...prev,
      currencies: [
        ...prev.currencies,
        {
          currency: newCurrency,
          chain_options: [...newChains],
          amount: '',
          is_primary: prev.currencies.length === 0,
        },
      ],
    }));
  };

  const removeCurrency = (index: number) => {
    setCreateForm(prev => {
      const newCurrencies = prev.currencies.filter((_, i) => i !== index);
      // If we removed the primary, make the first one primary
      if (prev.currencies[index].is_primary && newCurrencies.length > 0) {
        newCurrencies[0].is_primary = true;
      }
      return { ...prev, currencies: newCurrencies };
    });
  };

  const updateCurrency = (index: number, updates: Partial<CurrencyFormConfig>) => {
    setCreateForm(prev => {
      const newCurrencies = [...prev.currencies];

      // If setting this as primary, unset others
      if (updates.is_primary === true) {
        newCurrencies.forEach((c, i) => {
          if (i !== index) c.is_primary = false;
        });
      }

      // If changing currency, update chain options
      if (updates.currency && updates.currency !== newCurrencies[index].currency) {
        const newChains = chainOptionsMap.get(updates.currency) ?? [];
        newCurrencies[index] = {
          ...newCurrencies[index],
          ...updates,
          chain_options: [...newChains],
        };
      } else {
        newCurrencies[index] = { ...newCurrencies[index], ...updates };
      }

      return { ...prev, currencies: newCurrencies };
    });
  };

  const toggleChainForCurrency = (currencyIndex: number, chainId: string) => {
    setCreateForm(prev => {
      const newCurrencies = [...prev.currencies];
      const currency = newCurrencies[currencyIndex];
      const isSelected = currency.chain_options.includes(chainId);

      currency.chain_options = isSelected
        ? currency.chain_options.filter(c => c !== chainId)
        : [...currency.chain_options, chainId];

      return { ...prev, currencies: newCurrencies };
    });
  };

  const isActionLoading =
    publishPaymentLink.isPending ||
    unpublishPaymentLinkMutation.isPending ||
    archivePaymentLinkMutation.isPending ||
    restorePaymentLinkMutation.isPending;

  const isSaving = createPaymentLink.isPending || updatePaymentLink.isPending || updatePaymentLinkCurrencies.isPending;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${label} copied to clipboard`),
      () => toast.error('Failed to copy'),
    );
  };

  // Get all unique currencies and chains from a payment link
  const getDisplayCurrencies = (link: PaymentLink) => {
    return link.currencies.length > 0
      ? link.currencies
      : link.currency && link.chain_options
      ? [{ currency: link.currency, chain_options: link.chain_options, is_primary: true, amount: null }]
      : [];
  };

  const renderFilters = (isArchived: boolean) => (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by title, slug or currency"
          className="pl-9"
        />
      </div>
      {!isArchived && (
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        variant="outline"
        size="icon"
        onClick={() => queryClient.invalidateQueries({ queryKey: ['payment-links'] })}
        disabled={isLoading}
        title="Refresh list"
        aria-label="Refresh list"
      >
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>
  );

  const renderTable = (isArchived: boolean) => (
    <div className="rounded-lg border border-border overflow-hidden">
      {isLoading ? (
        <PaymentLinksTableSkeleton />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="min-w-[160px]">Amount</TableHead>
              <TableHead>Currencies</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {paymentLinks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <EmptyState
                  icon={Link2}
                  title={isArchived ? 'No archived payment links' : 'No payment links yet'}
                  description={
                    isArchived
                      ? 'Archived payment links will appear here once you archive an active link.'
                      : 'Create your first payment link to start accepting payments instantly.'
                  }
                  action={
                    isArchived
                      ? undefined
                      : (
                        <Button onClick={() => { setEditingLink(null); setIsCreateOpen(true); }}>
                          <Plus className="mr-2 h-4 w-4" />
                          Create payment link
                        </Button>
                      )
                  }
                  helpHref="https://docs.payin.com/en/guide/payment-links.html"
                  helpLabel="View payment links guide"
                  className="py-16"
                />
              </TableCell>
            </TableRow>
          ) : (
            paymentLinks.map((link) => {
              const shareUrl = link.slug
                ? `${publicBaseUrl.replace(/\/$/, '')}/checkout/${link.slug}`
                : '';
              const inventoryLabel =
                link.inventory_total == null
                  ? 'Unlimited'
                  : `${link.inventory_sold}/${link.inventory_total} sold`;
              const reservedLabel =
                link.inventory_total == null
                  ? `${link.inventory_reserved} reserved`
                  : `${link.inventory_reserved}/${link.inventory_total} reserved`;

              const displayCurrencies = getDisplayCurrencies(link);
              const primaryCurrency = displayCurrencies.find(c => c.is_primary) || displayCurrencies[0];
              const remaining =
                link.inventory_total == null
                  ? null
                  : Math.max(0, link.inventory_total - link.inventory_reserved - link.inventory_sold);

              return (
                <TableRow key={link.id}>
                  <TableCell className="space-y-1">
                    <p className="font-medium text-foreground">{link.title}</p>
                    {link.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{link.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Updated {format(new Date(link.updated_at), 'yyyy-MM-dd HH:mm')}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE_STYLES[link.status]}>
                      {STATUS_LABELS[link.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {formatAmount(link.amount, primaryCurrency?.currency || 'USD')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {displayCurrencies.map((curr, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs font-semibold">
                          {curr.currency}
                          {curr.is_primary && ' ★'}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-foreground">{inventoryLabel}</p>
                    <p className="text-xs text-muted-foreground">{reservedLabel}</p>
                    {remaining !== null && (
                      <p
                        className={`text-xs ${
                          remaining === 0 ? 'text-destructive font-medium' : 'text-muted-foreground'
                        }`}
                      >
                        {remaining} remaining
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {link.slug ? (
                      <span className="text-sm truncate max-w-[140px]">{link.slug}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not published</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {/* Primary Actions: Always Visible */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setOrdersModalLink(link)}
                        title="View orders"
                        aria-label="View orders"
                      >
                        <List className="w-4 h-4" />
                      </Button>

                      {!isArchived && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingLink(link);
                            resetCreateForm(link);
                            setIsCreateOpen(true);
                          }}
                          title="Edit payment link"
                          aria-label="Edit payment link"
                          disabled={isSaving}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Share Button: Only for published links with slug */}
                      {link.slug && link.status === 'published' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            handleCopy(shareUrl, 'Link URL');
                            window.open(shareUrl, '_blank', 'noopener');
                          }}
                          title="Copy and open link"
                          aria-label="Copy and open link"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}

                      {/* More Actions: Dropdown Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="More actions"
                            aria-label="More actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => setOrdersModalLink(link)}
                          >
                            <List className="w-4 h-4 mr-2" />
                            View Orders
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />

                          {!isArchived && link.status === 'draft' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => publishPaymentLink.mutate({ id: link.id })}
                                disabled={isActionLoading}
                              >
                                <Globe className="w-4 h-4 mr-2" />
                                Publish
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}

                          {!isArchived && link.status === 'published' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => unpublishPaymentLinkMutation.mutate({ id: link.id })}
                                disabled={isActionLoading}
                              >
                                <EyeOff className="w-4 h-4 mr-2" />
                                Unpublish
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}

                          {link.slug && (
                            <DropdownMenuItem
                              onClick={() => handleCopy(shareUrl, 'Link URL')}
                            >
                              <ClipboardCopy className="w-4 h-4 mr-2" />
                              Copy Link
                            </DropdownMenuItem>
                          )}

                          {!isArchived && (
                            <DropdownMenuItem
                              onClick={() => archivePaymentLinkMutation.mutate({ id: link.id, status: link.status })}
                              disabled={isActionLoading}
                              className="text-destructive focus:text-destructive"
                            >
                              <Archive className="w-4 h-4 mr-2" />
                              {link.status === 'published' ? 'Unpublish & Archive' : 'Archive'}
                            </DropdownMenuItem>
                          )}

                          {isArchived && (
                            <DropdownMenuItem
                              onClick={() => restorePaymentLinkMutation.mutate({ id: link.id })}
                              disabled={isActionLoading}
                            >
                              <ArchiveRestore className="w-4 h-4 mr-2" />
                              Restore
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      )}
    </div>
  );

  if (poolSummaryLoading) {
    return (
      <div className="p-4 lg:p-8 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!poolSummaryLoading && !poolSummaryError && !hasAnyAddresses) {
    return (
      <div className="p-4 lg:p-8">
        <AddressPoolSetupGuide context="payment-links" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Links</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage payment links for accepting crypto payments
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'active' | 'archived')}
        className="space-y-4"
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="active" className="flex-1 sm:flex-none">
            Active
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex-1 sm:flex-none">
            Archived
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                  <CardTitle>Payment Links</CardTitle>
                  <CardDescription>Manage publishing status, inventory and shareable URLs.</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setEditingLink(null);
                    resetCreateForm();
                    setIsCreateOpen(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderFilters(false)}
              {renderTable(false)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Archived Links</CardTitle>
              <CardDescription>Restore or review previously archived payment links.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderFilters(true)}
              {renderTable(true)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Payment Link Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setEditingLink(null);
          }
        }}
      >
        <FullscreenDialogContent className="sm:rounded-none md:rounded-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingLink ? 'Edit Payment Link' : 'Create Payment Link'}</DialogTitle>
            <DialogDescription>
              Configure currencies, networks, and preview the hosted checkout experience.
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col h-full min-h-0" onSubmit={handleCreateSubmit}>
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/50">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {editingLink ? 'Edit Payment Link' : 'Create Payment Link'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Configure currencies, networks, and preview the hosted checkout experience.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingLink(null);
                  }}
                  disabled={isSaving}
                >
                  Close
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (editingLink ? 'Saving...' : 'Creating...') : editingLink ? 'Save changes' : 'Create'}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
              <div className="grid h-full min-h-0 gap-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="flex h-full min-h-0 flex-col overflow-y-auto px-6 py-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="title">
                      Title
                    </label>
                    <Input
                      id="title"
                      value={createForm.title}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="e.g. Premium Onboarding Session"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="description">
                      Description (optional)
                    </label>
                    <Textarea
                      id="description"
                      rows={4}
                      value={createForm.description}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="Describe what your customer is paying for"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="amount">
                        Default Amount
                      </label>
                      <Input
                        id="amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={createForm.amount}
                        onChange={(event) =>
                          setCreateForm((prev) => ({ ...prev, amount: event.target.value }))
                        }
                        placeholder="0.00"
                        required={createForm.amountType === 'fixed'}
                        disabled={createForm.amountType === 'user_input'}
                      />
                      <p className="text-xs text-muted-foreground">
                        {createForm.amountType === 'fixed'
                          ? 'Buyers see this price when a currency does not specify its own amount.'
                          : 'Users will enter their own amount at checkout.'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="inventoryTotal">
                        Inventory (optional)
                      </label>
                      <Input
                        id="inventoryTotal"
                        type="number"
                        min="1"
                        step="1"
                        value={createForm.inventoryTotal}
                        onChange={(event) =>
                          setCreateForm((prev) => ({ ...prev, inventoryTotal: event.target.value }))
                        }
                        placeholder="Leave empty for unlimited"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="amountType">
                        Amount Type
                      </label>
                      <Select
                        value={createForm.amountType}
                        onValueChange={(value: 'fixed' | 'user_input') =>
                          setCreateForm((prev) => ({ ...prev, amountType: value }))
                        }
                      >
                        <SelectTrigger id="amountType">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                          <SelectItem value="user_input">User Input (e.g., donations)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Choose whether to use a fixed amount or let users enter their own amount.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="theme">
                        Theme
                      </label>
                      <Select
                        value={createForm.theme}
                        onValueChange={(value: 'dark' | 'light') =>
                          setCreateForm((prev) => ({ ...prev, theme: value }))
                        }
                      >
                        <SelectTrigger id="theme">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="light">Light</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Choose the checkout page theme (dark or light).
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="ctaText">
                      Call to Action Text (optional)
                    </label>
                    <Input
                      id="ctaText"
                      value={createForm.ctaText}
                      onChange={(event) =>
                        setCreateForm((prev) => ({ ...prev, ctaText: event.target.value }))
                      }
                      placeholder="e.g., Donate Now, Buy Now, Continue to Payment"
                      maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground">
                      Custom text for the submit button (defaults to "Continue to payment").
                    </p>
                  </div>

                  <div className="space-y-3 -mx-6 px-6 py-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">
                        Currencies ({createForm.currencies.length})
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCurrency}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Currency
                      </Button>
                    </div>

                    {createForm.currencies.length === 0 ? (
                      <div className="border border-dashed border-border rounded-lg p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No currencies configured. Click "Add Currency" to get started.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {createForm.currencies.map((currency, index) => (
                          <div
                            key={index}
                            className="border border-border rounded-lg p-4 space-y-4 relative bg-muted/50"
                          >
                            {createForm.currencies.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => removeCurrency(index)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}

                            {/* Currency selector - full width */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-foreground">
                                Currency
                              </label>
                              <Select
                                value={currency.currency}
                                onValueChange={(value) => updateCurrency(index, { currency: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {currencyOptions.map((token) => (
                                    <SelectItem key={token.symbol} value={token.symbol}>
                                      {token.symbol} · {token.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Default currency checkbox - highlighted */}
                            <div className={`flex items-center gap-2 p-3 rounded-md transition-colors ${
                              currency.is_primary ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                            }`}>
                              <Checkbox
                                id={`primary-${index}`}
                                checked={currency.is_primary}
                                onCheckedChange={(checked) =>
                                  updateCurrency(index, { is_primary: checked as boolean })
                                }
                              />
                              <label
                                htmlFor={`primary-${index}`}
                                className="text-sm font-medium cursor-pointer flex-1"
                              >
                                Set as default currency
                              </label>
                              {currency.is_primary && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                                  Default
                                </span>
                              )}
                            </div>

                            {/* Amount configuration - clearer labeling */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-foreground">
                                Price for this currency
                              </label>
                              <div className="flex items-center gap-3">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={currency.amount || ''}
                                  onChange={(e) => updateCurrency(index, { amount: e.target.value })}
                                  placeholder={`${createForm.amount || '0'}`}
                                  className="flex-1"
                                />
                                <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[120px]">
                                  {currency.amount ? 'Custom price' : `Default: ${createForm.amount || '0'}`}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Leave empty to use the default amount ({createForm.amount || '0'})
                              </p>
                            </div>

                            {/* Supported networks - 2 column grid */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-foreground">
                                Supported Networks
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {(chainOptionsMap.get(currency.currency) || []).map((chainId) => {
                                  const isSelected = currency.chain_options.includes(chainId);
                                  const isLastSelected = isSelected && currency.chain_options.length === 1;
                                  return (
                                    <div key={chainId} className="flex items-center gap-2">
                                      <Checkbox
                                        id={`chain-${index}-${chainId}`}
                                        checked={isSelected}
                                        disabled={isLastSelected}
                                        onCheckedChange={() => toggleChainForCurrency(index, chainId)}
                                      />
                                      <label
                                        htmlFor={`chain-${index}-${chainId}`}
                                        className={`text-sm cursor-pointer ${
                                          isLastSelected ? 'text-muted-foreground' : 'text-foreground'
                                        }`}
                                      >
                                        {formatChainName(chainId)}
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                              {currency.chain_options.length === 0 && (
                                <p className="text-xs text-destructive">
                                  Select at least one network for this currency.
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="hidden h-full min-h-0 flex-col border-t border-border md:flex md:border-t-0 md:border-l">
                  <div className="flex items-center justify-between px-6 py-4 bg-muted/50">
                    <p className="text-sm font-medium text-foreground">Checkout preview</p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 border border-border rounded-md p-1">
                        <Button
                          type="button"
                          variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setPreviewMode('desktop')}
                        >
                          <Monitor className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setPreviewMode('mobile')}
                        >
                          <Smartphone className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={openPreviewWindow}
                        disabled={!previewUrl || previewUrlLoading}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Open
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto px-6 py-4 bg-muted/30">
                    {previewUrlLoading ? (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-sm text-muted-foreground">Loading preview...</p>
                      </div>
                    ) : (
                      <div className="flex items-start justify-center h-full">
                        <div
                          className="bg-background rounded-xl shadow-2xl overflow-hidden transition-all duration-300 h-full"
                          style={{
                            width: previewMode === 'mobile' ? '263px' : '770px',
                            flexShrink: 0,
                          }}
                        >
                          <iframe
                            ref={previewIframeRef}
                            key={previewUrl || 'create-preview'}
                            title="Payment Link checkout preview"
                            src={previewUrl || undefined}
                            srcDoc={!previewUrl ? inlinePreviewHtml : undefined}
                            style={{
                              width: previewMode === 'mobile' ? '375px' : '1400px',
                              height: previewMode === 'mobile' ? 'calc(100% / 0.7)' : 'calc(100% / 0.55)',
                              border: 0,
                              backgroundColor: '#020617',
                              transform: previewMode === 'mobile' ? 'scale(0.7)' : 'scale(0.55)',
                              transformOrigin: 'top left',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-border px-6 py-4 md:hidden">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Checkout preview</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openPreviewWindow}
                    disabled={!previewUrl || previewUrlLoading}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Open
                  </Button>
                </div>
                {previewUrlLoading ? (
                  <div className="flex h-[220px] items-center justify-center">
                    <p className="text-sm text-muted-foreground">Loading preview...</p>
                  </div>
                ) : (
                  <div className="overflow-hidden">
                    <div style={{ transform: 'scale(0.6)', transformOrigin: 'top left' }}>
                      <iframe
                        title="Payment Link checkout preview (mobile)"
                        src={previewUrl || undefined}
                        srcDoc={!previewUrl ? inlinePreviewHtml : undefined}
                        style={{
                          width: '375px',
                          height: '667px',
                          border: 0,
                          borderRadius: '0.75rem',
                          backgroundColor: '#020617',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </form>
        </FullscreenDialogContent>
      </Dialog>

      {/* Currency Manager Dialog */}
      <Dialog open={isCurrencyManagerOpen} onOpenChange={setIsCurrencyManagerOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Currencies</DialogTitle>
            <DialogDescription>
              Manage currency and chain configurations for this payment link.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingLink) return;

              if (createForm.currencies.length === 0) {
                toast.error('Add at least one currency');
                return;
              }

              for (const curr of createForm.currencies) {
                if (!curr.currency || curr.chain_options.length === 0) {
                  toast.error('Each currency must have at least one chain');
                  return;
                }
              }

              const primaryCount = createForm.currencies.filter(c => c.is_primary).length;
              if (primaryCount !== 1) {
                toast.error('Exactly one currency must be primary');
                return;
              }

              updatePaymentLinkCurrencies.mutate({
                id: editingLink.id,
                currencies: createForm.currencies.map(c => ({
                  currency: c.currency,
                  chainOptions: c.chain_options,
                  amount: c.amount || null,
                  isPrimary: c.is_primary,
                })),
              });
            }}
          >
            <div className="space-y-3 -mx-6 px-6 py-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Currencies ({createForm.currencies.length})
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCurrency}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Currency
                </Button>
              </div>

              {createForm.currencies.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No currencies configured. Click "Add Currency" to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {createForm.currencies.map((currency, index) => (
                    <div
                      key={index}
                      className="border border-border rounded-lg p-4 space-y-4 relative bg-muted/50"
                    >
                      {createForm.currencies.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => removeCurrency(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Currency selector - full width */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Currency
                        </label>
                        <Select
                          value={currency.currency}
                          onValueChange={(value) => updateCurrency(index, { currency: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencyOptions.map((token) => (
                              <SelectItem key={token.symbol} value={token.symbol}>
                                {token.symbol} · {token.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Default currency checkbox - highlighted */}
                      <div className={`flex items-center gap-2 p-3 rounded-md transition-colors ${
                        currency.is_primary ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                      }`}>
                        <Checkbox
                          id={`dialog-primary-${index}`}
                          checked={currency.is_primary}
                          onCheckedChange={(checked) =>
                            updateCurrency(index, { is_primary: checked as boolean })
                          }
                        />
                        <label
                          htmlFor={`dialog-primary-${index}`}
                          className="text-sm font-medium cursor-pointer flex-1"
                        >
                          Set as default currency
                        </label>
                        {currency.is_primary && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                            Default
                          </span>
                        )}
                      </div>

                      {/* Amount configuration - clearer labeling */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Price for this currency
                        </label>
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={currency.amount || ''}
                            onChange={(e) => updateCurrency(index, { amount: e.target.value })}
                            placeholder={`${createForm.amount || '0'}`}
                            className="flex-1"
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[120px]">
                            {currency.amount ? 'Custom price' : `Default: ${createForm.amount || '0'}`}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Leave empty to use the default amount ({createForm.amount || '0'})
                        </p>
                      </div>

                      {/* Supported networks - 2 column grid */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                          Supported Networks
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {(chainOptionsMap.get(currency.currency) || []).map((chainId) => {
                            const isSelected = currency.chain_options.includes(chainId);
                            const isLastSelected = isSelected && currency.chain_options.length === 1;
                            return (
                              <div key={chainId} className="flex items-center gap-2">
                                <Checkbox
                                  id={`dialog-chain-${index}-${chainId}`}
                                  checked={isSelected}
                                  disabled={isLastSelected}
                                  onCheckedChange={() => toggleChainForCurrency(index, chainId)}
                                />
                                <label
                                  htmlFor={`dialog-chain-${index}-${chainId}`}
                                  className={`text-sm cursor-pointer ${
                                    isLastSelected ? 'text-muted-foreground' : 'text-foreground'
                                  }`}
                                >
                                  {formatChainName(chainId)}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                        {currency.chain_options.length === 0 && (
                          <p className="text-xs text-destructive">
                            Select at least one network for this currency.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCurrencyManagerOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Link Orders Modal */}
      <PaymentLinkOrdersModal
        open={!!ordersModalLink}
        onOpenChange={(open) => !open && setOrdersModalLink(null)}
        paymentLink={ordersModalLink}
      />
    </div>
  );
}

/**
 * Payment Links Table Skeleton Loader
 */
function PaymentLinksTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent border-border">
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="min-w-[160px]">Amount</TableHead>
          <TableHead>Currencies</TableHead>
          <TableHead>Inventory</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead className="w-[140px] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[1, 2, 3, 4, 5].map((i) => (
          <TableRow key={i} className="border-border">
            <TableCell>
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-28" />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
