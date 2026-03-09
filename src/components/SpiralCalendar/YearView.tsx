import React from 'react';
import { MonthSector } from '../MonthSector';
import { YEAR_VIEW_INNER_R, YEAR_VIEW_OUTER_R, SVG_CX, SVG_CY } from '../../constants/geometry';
import type { ViewMode, Locale, DateRange } from '../../types/calendar';
import { useCalendarStore } from '../../store/calendarStore';
interface YearViewProps {
  year: number;
  viewMode: ViewMode;
  locale: Locale;
  selectedRange: DateRange | null;
}

export const YearView: React.FC<YearViewProps> = ({
  year,
  viewMode,
  locale,
  selectedRange,
}) => {
  const zoomIn = useCalendarStore((s) => s.zoomIn);
  const setHoverDate = useCalendarStore((s) => s.setHoverDate);
  const selectedDate = useCalendarStore((s) => s.selectedDate);
  const currentYear = new Date().getFullYear();

  return (
    <g>
      {/* Year label in center */}
      <text
        x={SVG_CX}
        y={SVG_CY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={28}
        fontFamily="system-ui, sans-serif"
        fill={year === currentYear ? '#EF4444' : '#444'}
        fontWeight="700"
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {year}
      </text>

      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
        const isSelected =
          selectedDate !== null &&
          selectedDate.year === year &&
          selectedDate.month === month;

        return (
          <MonthSector
            key={month}
            year={year}
            month={month}
            innerR={YEAR_VIEW_INNER_R}
            outerR={YEAR_VIEW_OUTER_R}
            viewMode={viewMode}
            locale={locale}
            selectedRange={selectedRange}
            isSelected={isSelected}
            onClick={() => zoomIn({ year, month })}
            onMouseEnter={() => setHoverDate({ year, month, day: 1 })}
            onMouseLeave={() => setHoverDate(null)}
            fontSize={13}
          />
        );
      })}

      {/* Month names around the ring */}
      {year === currentYear && (
        <circle
          cx={SVG_CX}
          cy={SVG_CY}
          r={(YEAR_VIEW_INNER_R + YEAR_VIEW_OUTER_R) / 2}
          fill="none"
          stroke="#EF4444"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.3}
          pointerEvents="none"
        />
      )}
    </g>
  );
};
