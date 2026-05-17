/**
 * TimeRangeSelector Component
 *
 * A unified time range selector component used across different pages.
 * Provides buttons to switch between 24h, 7d, 30d, and all time ranges.
 *
 * This component controls the entire page's data filtering, including:
 * - Overview statistics cards
 * - Table/list data
 * - Any time-based analytics
 */

export type TimeRange = '24h' | '7d' | '30d' | 'all';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  const ranges: Array<{ value: TimeRange; label: string }> = [
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="flex justify-end">
      <div className="inline-flex rounded-lg border border-border bg-background p-1">
        {ranges.map((range) => (
          <button
            key={range.value}
            onClick={() => onChange(range.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              value === range.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Get time range in milliseconds from time range value
 * Returns null for 'all' (no time filtering)
 */
export function getTimeRangeMs(timeRange: TimeRange): number | null {
  if (timeRange === 'all') return null;
  return timeRange === '24h' ? 24 * 60 * 60 * 1000 :
         timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
         30 * 24 * 60 * 60 * 1000;
}

/**
 * Get start date from time range
 * Returns null for 'all' (no time filtering)
 *
 * @example
 * ```typescript
 * const startDate = getStartDateFromTimeRange('24h');
 * // Use in API calls
 * const params = {
 *   ...(startDate && { createdAfter: startDate.toISOString() })
 * };
 * ```
 */
export function getStartDateFromTimeRange(timeRange: TimeRange): Date | null {
  if (timeRange === 'all') return null;

  const now = new Date();
  const rangeMs = getTimeRangeMs(timeRange);
  if (rangeMs === null) return null;

  return new Date(now.getTime() - rangeMs);
}
