import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PoolOverviewGrid } from '@/components/address-pool/PoolOverviewGrid';
import { AddressesTabContent } from '@/components/address-pool/AddressesTabContent';
import { PoolInfoSection } from '@/components/address-pool/PoolInfoSection';

/**
 * Address Pool Page
 * Two main tabs: Overview and Addresses
 */
export default function AddressPool() {
  const location = useLocation();
  const [mainTab, setMainTab] = useState<string>('overview');
  const [selectedProtocol, setSelectedProtocol] = useState<string>('all');

  // Protocol configuration - can be extended dynamically in the future
  const protocols = useMemo(
    () => [
    { protocol: 'evm', displayName: 'EVM' },
    { protocol: 'tron', displayName: 'Tron' },
    // Future protocols can be added here
  ],
    []
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const state = (location.state as { focusTab?: string; protocol?: string } | null) ?? {};

    const focusTab = state.focusTab ?? searchParams.get('tab');
    if (focusTab === 'addresses' || focusTab === 'overview') {
      setMainTab(focusTab);
    }

    const protocolFromState = state.protocol ?? searchParams.get('protocol');
    if (protocolFromState && protocols.some((p) => p.protocol === protocolFromState)) {
      setSelectedProtocol(protocolFromState);
    }
  }, [location, protocols]);

  return (
    <div className="p-4 lg:p-8">
      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
        <TabsList className="bg-muted">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <PoolOverviewGrid />
          <PoolInfoSection />
        </TabsContent>

        {/* Addresses Tab */}
        <TabsContent value="addresses" className="space-y-6">
          <AddressesTabContent
            protocols={protocols}
            initialProtocol={selectedProtocol}
            onProtocolChange={setSelectedProtocol}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
