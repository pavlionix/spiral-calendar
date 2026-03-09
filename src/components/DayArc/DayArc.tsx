import React, { useState } from 'react';
import { describeSector, dayMidAngle, arcLabelPlacement } from '../../utils/geometry';
import { MONTH_COLORS, SELECTION_FILL, RANGE_FILL, TODAY_STROKE, ANCHOR_FILL } from '../../constants/colors';
import type { CalendarDate, DateRange } from '../../types/calendar';
import { calendarDatesEqual, isInRange, isRangeStart, isRangeEnd, isWeekend, normalizeRange } from '../../utils/dateUtils';
import { MONTH_VIEW_INNER_R, MONTH_VIEW_OUTER_R } from '../../constants/geometry';

interface DayArcProps {
  date: CalendarDate;
  dayIndex: number;
  totalDays: number;
  innerR?: number;
  outerR?: number;
  isToday: boolean;
  selectedDate: CalendarDate | null;
  selectedRange: DateRange | null;
  rangeAnchor: CalendarDate | null;
  hoverDate: CalendarDate | null;
  selectionMode: 'single' | 'range';
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  showLabel?: boolean;
}

export const DayArc: React.FC<DayArcProps> = ({
  date,
  dayIndex,
  totalDays,
  innerR = MONTH_VIEW_INNER_R,
  outerR = MONTH_VIEW_OUTER_R,
  isToday,
  selectedDate,
  selectedRange,
  rangeAnchor,
  hoverDate,
  selectionMode,
  onClick,
  onMouseEnter,
  onMouseLeave,
  showLabel = true,
}) => {
  const [hovered, setHovered] = useState(false);

  const startAngle = (dayIndex / totalDays) * 2 * Math.PI;
  const endAngle = ((dayIndex + 1) / totalDays) * 2 * Math.PI;

  const pathD = describeSector(innerR, outerR, startAngle, endAngle);

  const baseColor = MONTH_COLORS[date.month];
  const isWknd = isWeekend(date);

  // Determine overlay
  const isSelected = selectionMode === 'single' && calendarDatesEqual(date, selectedDate);
  const isAnchor = calendarDatesEqual(date, rangeAnchor);

  // Live range preview
  let liveRange: DateRange | null = selectedRange;
  if (selectionMode === 'range' && rangeAnchor && hoverDate) {
    liveRange = normalizeRange(rangeAnchor, hoverDate);
  }

  const inRange = liveRange ? isInRange(date, liveRange) : false;
  const isStart = liveRange ? isRangeStart(date, liveRange) : false;
  const isEnd = liveRange ? isRangeEnd(date, liveRange) : false;

  const midAngle = dayMidAngle(dayIndex, totalDays);
  const midR = (innerR + outerR) / 2;
  const label = arcLabelPlacement(midAngle, midR);

  let fillColor = baseColor;
  if (isWknd) {
    // Slightly darker for weekends
    fillColor = baseColor;
  }
  if (hovered) {
    fillColor = baseColor + 'CC';
  }

  return (
    <g
      onClick={onClick}
      onMouseEnter={() => {
        setHovered(true);
        onMouseEnter();
      }}
      onMouseLeave={() => {
        setHovered(false);
        onMouseLeave();
      }}
      style={{ cursor: 'pointer' }}
    >
      <path
        d={pathD}
        fill={fillColor}
        stroke="white"
        strokeWidth={0.5}
        style={isWknd ? { filter: 'brightness(0.92)' } : undefined}
        opacity={hovered ? 0.85 : 1}
      />

      {/* Selection overlay */}
      {isSelected && (
        <path d={pathD} fill={SELECTION_FILL} stroke="none" pointerEvents="none" />
      )}
      {isAnchor && (
        <path d={pathD} fill={ANCHOR_FILL} stroke="none" pointerEvents="none" />
      )}
      {inRange && !isAnchor && (
        <path
          d={pathD}
          fill={isStart || isEnd ? SELECTION_FILL : RANGE_FILL}
          stroke="none"
          pointerEvents="none"
        />
      )}

      {/* Today marker */}
      {isToday && (
        <path
          d={pathD}
          fill="none"
          stroke={TODAY_STROKE}
          strokeWidth={2}
          pointerEvents="none"
        />
      )}

      {/* Day number label */}
      {showLabel && (
        <text
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={totalDays > 28 ? 8 : 9}
          fontFamily="system-ui, sans-serif"
          fill={isToday ? '#EF4444' : '#333'}
          fontWeight={isToday ? '700' : '400'}
          transform={`rotate(${label.rotation}, ${label.x}, ${label.y})`}
          pointerEvents="none"
          style={{ userSelect: 'none' }}
        >
          {date.day}
        </text>
      )}
    </g>
  );
};
