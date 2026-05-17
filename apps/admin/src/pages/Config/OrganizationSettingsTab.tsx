/**
 * OrganizationSettingsTab Component
 * Unified organization settings including business configuration and webhooks
 */

import { Building2, Webhook } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrganizationConfigSection } from './sections/OrganizationConfigSection';
import { WebhookSection } from './sections/WebhookSection';

export function OrganizationSettingsTab() {
  const { organization } = useAuth();

  const canManage = organization?.role === 'owner' || organization?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Organization Settings</h2>
        </div>
        <p className="text-muted-foreground">
          Manage all settings for <span className="font-semibold text-foreground">{organization?.name}</span>.
          {canManage
            ? ' Configure business rules, services, and notification webhooks.'
            : ' View organization configuration (editing requires owner or admin role).'}
        </p>
      </div>

      {/* Settings Sections */}
      <Tabs defaultValue="config" className="w-full">
        <TabsList>
          <TabsTrigger value="config" className="gap-2">
            <Building2 className="w-4 h-4" />
            Business Configuration
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="w-4 h-4" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6">
          <OrganizationConfigSection />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6">
          <WebhookSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
