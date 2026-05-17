import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface AddressFiltersProps {
  statusFilter: string;
  typeFilter: string;
  searchQuery: string;
  onStatusChange: (status: string) => void;
  onTypeChange: (type: string) => void;
  onSearchChange: (query: string) => void;
  onClearFilters: () => void;
}

/**
 * Address Filters Component
 * Provides filtering controls for address list (status, type, search)
 */
export function AddressFilters({
  statusFilter,
  typeFilter,
  searchQuery,
  onStatusChange,
  onTypeChange,
  onSearchChange,
  onClearFilters,
}: AddressFiltersProps) {
  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || searchQuery !== '';

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
      {/* Status Filter */}
      <div className="w-full sm:w-48">
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="allocated">Allocated</SelectItem>
            <SelectItem value="bound">Bound</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Type Filter */}
      <div className="w-full sm:w-48">
        <Select value={typeFilter} onValueChange={onTypeChange}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="order">Order</SelectItem>
            <SelectItem value="deposit">Deposit</SelectItem>
            <SelectItem value="new">New (Unused)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Search Input */}
      <div className="w-full sm:flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by address or reference..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-background text-foreground"
        />
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="whitespace-nowrap text-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
