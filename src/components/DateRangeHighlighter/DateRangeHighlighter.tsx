import React from 'react';
import { useCalendarStore } from '../../store/calendarStore';
import { normalizeRange } from '../../utils/dateUtils';
import type { DateRange } from '../../types/calendar';

// This component renders a pointer-events:none overlay group
// The actual highlighting is done within MonthSector and DayArc components
// This component exposes the computed live range for consumers
interface DateRangeHighlighterProps {
  children: (liveRange: DateRange | null) => React.ReactNode;
}

export const DateRangeHighlighter: React.FC<DateRangeHighlighterProps> = ({ children }) => {
  const { rangeAnchor, hoverDate, selectedRange, selectionMode } = useCalendarStore();

  let liveRange: DateRange | null = selectedRange;
  if (selectionMode === 'range' && rangeAnchor && hoverDate) {
    liveRange = normalizeRange(rangeAnchor, hoverDate);
  }

  return <g pointerEvents="none">{children(liveRange)}</g>;
};
