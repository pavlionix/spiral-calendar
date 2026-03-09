import React from 'react';
import { useCalendarStore } from '../../store/calendarStore';
import { useAnimatedTransition } from '../../hooks/useAnimatedTransition';
import { SVG_WIDTH, SVG_HEIGHT } from '../../constants/geometry';
import { normalizeRange } from '../../utils/dateUtils';
import type { DateRange } from '../../types/calendar';
import { YearsView } from './YearsView';
import { YearView } from './YearView';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';

export const SpiralCalendar: React.FC = () => {
  const {
    zoomLevel,
    focusedYear,
    focusedMonth,
    focusedWeek,
    viewMode,
    locale,
    selectedRange,
    rangeAnchor,
    hoverDate,
    selectionMode,
    setHoverDate,
  } = useCalendarStore();

  const transitionClass = useAnimatedTransition(
    `${zoomLevel}-${focusedYear}-${focusedMonth}-${focusedWeek}`
  );

  // Compute live range for passing down to views
  let liveRange: DateRange | null = selectedRange;
  if (selectionMode === 'range' && rangeAnchor && hoverDate) {
    liveRange = normalizeRange(rangeAnchor, hoverDate);
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      style={{ maxWidth: 700, width: '100%' }}
      onMouseLeave={() => setHoverDate(null)}
    >
      <g className={transitionClass}>
        {zoomLevel === 'years' && (
          <YearsView
            centerYear={focusedYear}
            viewMode={viewMode}
            locale={locale}
            selectedRange={liveRange}
          />
        )}
        {zoomLevel === 'year' && (
          <YearView
            year={focusedYear}
            viewMode={viewMode}
            locale={locale}
            selectedRange={liveRange}
          />
        )}
        {zoomLevel === 'month' && focusedMonth !== null && (
          <MonthView year={focusedYear} month={focusedMonth} />
        )}
        {zoomLevel === 'week' && focusedMonth !== null && focusedWeek !== null && (
          <WeekView
            year={focusedYear}
            month={focusedMonth}
            weekNumber={focusedWeek}
          />
        )}
      </g>
    </svg>
  );
};
