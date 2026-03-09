import React from 'react';
import { CalendarRing } from '../CalendarRing';
import { YEARS_VIEW_RINGS } from '../../constants/geometry';
import {
  describeCircularArc,
  describeSpiralEventArc,
  eventDotPos,
  monthStartAngle,
  monthEndAngle,
} from '../../utils/geometry';
import { getEventArcSegments, isLongEvent } from '../../utils/eventUtils';
import type { ViewMode, Locale, DateRange } from '../../types/calendar';
import { useCalendarStore } from '../../store/calendarStore';

const NUM_YEARS = 5;

interface YearsViewProps {
  centerYear: number;
  viewMode: ViewMode;
  locale: Locale;
  selectedRange: DateRange | null;
}

export const YearsView: React.FC<YearsViewProps> = ({
  centerYear, viewMode, locale, selectedRange,
}) => {
  const zoomIn = useCalendarStore((s) => s.zoomIn);
  const events = useCalendarStore((s) => s.events);
  const currentYear = new Date().getFullYear();

  const years = [
    centerYear - 2,
    centerYear - 1,
    centerYear,
    centerYear + 1,
    centerYear + 2,
  ];

  return (
    <g>
      {/* Year rings */}
      {years.map((year, i) => (
        <CalendarRing
          key={year}
          year={year}
          innerR={YEARS_VIEW_RINGS[i].innerR}
          outerR={YEARS_VIEW_RINGS[i].outerR}
          isCurrentYear={year === currentYear}
          viewMode={viewMode}
          yearIndex={i}
          numYears={NUM_YEARS}
          locale={locale}
          selectedRange={selectedRange}
          onMonthClick={(y, month) => zoomIn({ year: y, month })}
        />
      ))}

      {/* Event overlays (pointer-events: none so they don't block clicks) */}
      <g pointerEvents="none">
        {events.map((event) => {
          const segments = getEventArcSegments(event, years);
          const long = isLongEvent(event);

          return segments.map(({ yearIndex, startMonth, endMonth }) => {
            const outerR = YEARS_VIEW_RINGS[yearIndex].outerR;
            const arcR   = outerR + 5;
            const opacity = event.completed ? 0.3 : 0.85;

            if (long) {
              // Multi-month: draw a thick arc along the outer edge of the ring
              const d = viewMode === 'spiral'
                ? describeSpiralEventArc(yearIndex, NUM_YEARS, startMonth, endMonth)
                : describeCircularArc(arcR, monthStartAngle(startMonth), monthEndAngle(endMonth));

              return (
                <path
                  key={`${event.id}-${yearIndex}`}
                  d={d}
                  fill="none"
                  stroke={event.color}
                  strokeWidth={5}
                  strokeLinecap="round"
                  opacity={opacity}
                />
              );
            } else {
              // Single-day / short: small dot at month midpoint
              const pos = eventDotPos(
                yearIndex, NUM_YEARS,
                startMonth,
                viewMode,
                outerR,
              );
              return (
                <circle
                  key={`${event.id}-${yearIndex}`}
                  cx={pos.x}
                  cy={pos.y}
                  r={4}
                  fill={event.color}
                  opacity={opacity}
                />
              );
            }
          });
        })}
      </g>
    </g>
  );
};

