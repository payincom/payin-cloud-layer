import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddressTable } from './AddressTable';
import { AddressFilters } from './AddressFilters';

interface AddressPoolTabsProps {
  protocols: Array<{
    protocol: string;
    displayName: string;
  }>;
  defaultTab?: string;
  onTabChange?: (tab: string) => void;
}

/**
 * Address Pool Tabs Component
 * Main tabbed interface for viewing addresses by protocol
 */
export function AddressPoolTabs({ protocols, defaultTab = 'all', onTabChange }: AddressPoolTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync external tab changes
  useEffect(() => {
    if (defaultTab !== activeTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="bg-muted">
        {/* All Addresses Tab */}
        <TabsTrigger value="all">All Addresses</TabsTrigger>

        {/* Dynamic Protocol Tabs */}
        {protocols.map((p) => (
          <TabsTrigger key={p.protocol} value={p.protocol}>
            {p.displayName}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* All Addresses Tab Content */}
      <TabsContent value="all" className="space-y-4">
        <AddressFilters
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          searchQuery={searchQuery}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
          onSearchChange={setSearchQuery}
          onClearFilters={handleClearFilters}
        />
        <AddressTable
          protocol={null}
          showProtocolColumn={true}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          searchQuery={searchQuery}
        />
      </TabsContent>

      {/* Dynamic Protocol Tab Contents */}
      {protocols.map((p) => (
        <TabsContent key={p.protocol} value={p.protocol} className="space-y-4">
          <AddressFilters
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            searchQuery={searchQuery}
            onStatusChange={setStatusFilter}
            onTypeChange={setTypeFilter}
            onSearchChange={setSearchQuery}
            onClearFilters={handleClearFilters}
          />
          <AddressTable
            protocol={p.protocol}
            showProtocolColumn={false}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            searchQuery={searchQuery}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
