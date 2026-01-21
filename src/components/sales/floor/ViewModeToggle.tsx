'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Phone, Target } from 'lucide-react';
import type { SalesFloorViewMode } from '@/types/sales-floor';

interface ViewModeToggleProps {
  defaultMode?: SalesFloorViewMode;
  userJobTitle?: string | null;
  onModeChange?: (mode: SalesFloorViewMode) => void;
}

const STORAGE_KEY = 'sales-floor-view-mode';

export function ViewModeToggle({
  defaultMode,
  userJobTitle,
  onModeChange,
}: ViewModeToggleProps) {
  const [mode, setMode] = useState<SalesFloorViewMode>(() => {
    // Priority: defaultMode prop > localStorage > job title inference > 'closer'
    if (defaultMode) return defaultMode;

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY) as SalesFloorViewMode | null;
      if (stored === 'closer' || stored === 'setter') return stored;
    }

    // Infer from job title
    if (userJobTitle === 'closer' || userJobTitle === 'head_coach') return 'closer';
    // Setters might have various titles, default to closer if unclear

    return 'closer';
  });

  useEffect(() => {
    // Persist to localStorage
    localStorage.setItem(STORAGE_KEY, mode);
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  const handleToggle = (newMode: SalesFloorViewMode) => {
    setMode(newMode);
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-gray-800/50 rounded-lg">
      <button
        onClick={() => handleToggle('closer')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
          mode === 'closer'
            ? 'bg-emerald-600 text-white shadow-lg'
            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
        )}
      >
        <Phone className="w-4 h-4" />
        Closer
      </button>
      <button
        onClick={() => handleToggle('setter')}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
          mode === 'setter'
            ? 'bg-blue-600 text-white shadow-lg'
            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
        )}
      >
        <Target className="w-4 h-4" />
        Setter
      </button>
    </div>
  );
}
