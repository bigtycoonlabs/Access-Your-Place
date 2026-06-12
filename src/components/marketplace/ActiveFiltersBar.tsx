import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Filter } from 'lucide-react';

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  displayValue: string;
}

interface ActiveFiltersBarProps {
  filters: ActiveFilter[];
  resultCount: number;
  onRemoveFilter: (key: string, value: string) => void;
  onClearAll: () => void;
}

export function ActiveFiltersBar({ filters, resultCount, onRemoveFilter, onClearAll }: ActiveFiltersBarProps) {
  if (filters.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 flex-shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-medium">Active Filters:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filters.map((filter, idx) => (
              <Badge
                key={`${filter.key}-${filter.value}-${idx}`}
                variant="secondary"
                className="bg-[#1a365d]/10 text-[#1a365d] hover:bg-[#1a365d]/20 cursor-pointer transition-all pl-2.5 pr-1.5 py-1 gap-1 text-xs font-medium group"
                onClick={() => onRemoveFilter(filter.key, filter.value)}
              >
                <span className="text-[#1a365d]/60 mr-0.5">{filter.label}:</span>
                {filter.displayValue}
                <X className="w-3 h-3 ml-0.5 opacity-50 group-hover:opacity-100 transition-opacity" />
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-400">
            {resultCount.toLocaleString()} result{resultCount !== 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 text-xs px-2"
          >
            <X className="w-3 h-3 mr-1" />
            Clear All
          </Button>
        </div>
      </div>
    </div>
  );
}
