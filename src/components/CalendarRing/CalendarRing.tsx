import React from 'react';
import { MonthSector } from '../MonthSector';
import { polarToCartesian, spiralYearLabelPos, spiralTodayRadius } from '../../utils/geometry';
import { SVG_CX, SVG_CY } from '../../constants/geometry';
import type { ViewMode, Locale, DateRange } from '../../types/calendar';
import { useCalendarStore } from '../../store/calendarStore';

interface CalendarRingProps {
  year: number;
  innerR: number;
  outerR: number;
  isCurrentYear: boolean;
  viewMode: ViewMode;
  // Circular mode: uses innerR/outerR
  // Spiral mode: uses yearIndex/numYears
  yearIndex?: number;
  numYears?: number;
  locale: Locale;
  selectedRange: DateRange | null;
  onMonthClick: (year: number, month: number) => void;
}

export const CalendarRing: React.FC<CalendarRingProps> = ({
  year,
  innerR,
  outerR,
  isCurrentYear,
  viewMode,
  yearIndex = 0,
  numYears = 5,
  locale,
  selectedRange,
  onMonthClick,
}) => {
  const setHoverDate = useCalendarStore((s) => s.setHoverDate);
  const selectedDate = useCalendarStore((s) => s.selectedDate);

  const isSpiral = viewMode === 'spiral';
  const fontSize = isSpiral ? 9 : (outerR - innerR > 50 ? 11 : 9);

  // Year label position
  const yearLabelPos = isSpiral
    ? spiralYearLabelPos(yearIndex, numYears, SVG_CX, SVG_CY)
    : polarToCartesian((innerR + outerR) / 2, 0, SVG_CX, SVG_CY);

  // Today indicator radius (for spiral: approximate circle)
  const todayR = isSpiral
    ? spiralTodayRadius(yearIndex, numYears, SVG_CX, SVG_CY)
    : (innerR + outerR) / 2;

  return (
    <g>
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
            innerR={innerR}
            outerR={outerR}
            viewMode={viewMode}
            yearIndex={yearIndex}
            numYears={numYears}
            locale={locale}
            selectedRange={selectedRange}
            isSelected={isSelected}
            onClick={() => onMonthClick(year, month)}
            onMouseEnter={() => setHoverDate({ year, month, day: 1 })}
            onMouseLeave={() => setHoverDate(null)}
            fontSize={fontSize}
          />
        );
      })}

      {/* Year label */}
      <text
        x={yearLabelPos.x}
        y={yearLabelPos.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize + 1}
        fontFamily="system-ui, sans-serif"
        fill={isCurrentYear ? '#EF4444' : '#555'}
        fontWeight={isCurrentYear ? '700' : '500'}
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {year}
      </text>

      {/* Today indicator: dashed ring */}
      {isCurrentYear && (
        <circle
          cx={SVG_CX}
          cy={SVG_CY}
          r={todayR}
          fill="none"
          stroke="#EF4444"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          pointerEvents="none"
          opacity={0.6}
        />
      )}
    </g>
  );
};
