import { useState, useEffect } from 'react';
import { AddressTable } from './AddressTable';
import { AddressFilters } from './AddressFilters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AddressesTabContentProps {
  protocols: Array<{
    protocol: string;
    displayName: string;
  }>;
  initialProtocol?: string;
  onProtocolChange?: (protocol: string) => void;
}

/**
 * Addresses Tab Content Component
 * Main content for the Addresses tab with protocol selector and filters
 */
export function AddressesTabContent({
  protocols,
  initialProtocol = 'all',
  onProtocolChange,
}: AddressesTabContentProps) {
  const [selectedProtocol, setSelectedProtocol] = useState(initialProtocol);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Update selected protocol when initialProtocol changes
  useEffect(() => {
    if (initialProtocol !== selectedProtocol) {
      setSelectedProtocol(initialProtocol);
    }
  }, [initialProtocol]);

  const handleProtocolChange = (protocol: string) => {
    setSelectedProtocol(protocol);
    onProtocolChange?.(protocol);
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Filters Row - Protocol + Status + Type + Search + Clear */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Protocol Selector */}
        <div className="w-full sm:w-48">
          <Select value={selectedProtocol} onValueChange={handleProtocolChange}>
            <SelectTrigger id="protocol-select" className="bg-background">
              <SelectValue placeholder="Select protocol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Protocols</SelectItem>
              {protocols.map((p) => (
                <SelectItem key={p.protocol} value={p.protocol}>
                  {p.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status + Type + Search + Clear */}
        <AddressFilters
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          searchQuery={searchQuery}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
          onSearchChange={setSearchQuery}
          onClearFilters={handleClearFilters}
        />
      </div>

      {/* Address Table */}
      <AddressTable
        protocol={selectedProtocol === 'all' ? null : selectedProtocol}
        showProtocolColumn={selectedProtocol === 'all'}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        searchQuery={searchQuery}
      />
    </div>
  );
}
