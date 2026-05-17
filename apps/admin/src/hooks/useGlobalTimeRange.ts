/**
 * Global Time Range Hook
 *
 * Provides a shared time range state across all pages with localStorage persistence.
 * This ensures users' time range preference is maintained when navigating between pages
 * and persists across browser sessions.
 */

import { useState } from 'react';

const STORAGE_KEY = 'payin_global_time_range';

export type TimeRange = '24h' | '7d' | '30d' | 'all';

/**
 * Custom hook for managing global time range state
 *
 * @returns A tuple of [timeRange, setTimeRange] similar to useState
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [timeRange, setTimeRange] = useGlobalTimeRange();
 *
 *   return (
 *     <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
 *   );
 * }
 * ```
 */
export function useGlobalTimeRange(): [TimeRange, (value: TimeRange) => void] {
  const [timeRange, setTimeRangeState] = useState<TimeRange>(() => {
    // Initialize from localStorage if available
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ['24h', '7d', '30d', 'all'].includes(stored)) {
        return stored as TimeRange;
      }
    } catch (error) {
      console.warn('Failed to read time range from localStorage:', error);
    }
    // Default to 24h if nothing stored or invalid value
    return '24h';
  });

  const setTimeRange = (value: TimeRange) => {
    setTimeRangeState(value);

    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      console.warn('Failed to save time range to localStorage:', error);
    }
  };

  return [timeRange, setTimeRange];
}
