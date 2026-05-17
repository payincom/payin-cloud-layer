import { useSyncExternalStore } from 'react';

/**
 * Revenue Display Mode Type
 * - merged: Show total USD with token breakdown
 * - separate: Show each token separately
 */
export type RevenueDisplayMode = 'merged' | 'separate';

const STORAGE_KEY = 'payin_revenue_display_mode';
const DEFAULT_MODE: RevenueDisplayMode = 'merged';

// Storage event listeners for cross-tab sync
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): RevenueDisplayMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as RevenueDisplayMode) || DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function setMode(mode: RevenueDisplayMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    // Notify all listeners
    listeners.forEach(listener => listener());
  } catch (error) {
    console.error('Failed to save revenue display mode:', error);
  }
}

/**
 * Custom hook to manage revenue display mode preference
 * Stores preference in localStorage with immediate reactivity
 */
export function useRevenueDisplayMode() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const updateMode = (newMode: RevenueDisplayMode) => {
    setMode(newMode);
  };

  const toggleMode = () => {
    const current = getSnapshot();
    setMode(current === 'merged' ? 'separate' : 'merged');
  };

  return { mode, setMode: updateMode, toggleMode };
}
