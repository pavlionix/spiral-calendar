import React, { useState } from 'react';
import {
  describeSector,
  describeSpiralSector,
  spiralLabelPlacement,
  monthStartAngle,
  monthEndAngle,
  monthMidAngle,
  arcLabelPlacement,
} from '../../utils/geometry';
import { MONTH_COLORS, MONTH_COLORS_HOVER, SELECTION_FILL } from '../../constants/colors';
import { getMonthNameShort } from '../../utils/localization';
import type { ViewMode, Locale, DateRange } from '../../types/calendar';
import { isInRange } from '../../utils/dateUtils';

interface MonthSectorProps {
  year: number;
  month: number;
  innerR: number;
  outerR: number;
  viewMode: ViewMode;
  // Spiral-mode props
  yearIndex?: number;
  numYears?: number;
  locale: Locale;
  selectedRange: DateRange | null;
  isSelected?: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  fontSize?: number;
}

export const MonthSector: React.FC<MonthSectorProps> = ({
  year,
  month,
  innerR,
  outerR,
  viewMode,
  yearIndex = 0,
  numYears = 5,
  locale,
  selectedRange,
  isSelected = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  fontSize = 11,
}) => {
  const [hovered, setHovered] = useState(false);

  const isSpiral = viewMode === 'spiral';

  const pathD = isSpiral
    ? describeSpiralSector(yearIndex, numYears, month)
    : describeSector(innerR, outerR, monthStartAngle(month), monthEndAngle(month));

  const label = isSpiral
    ? spiralLabelPlacement(yearIndex, numYears, month)
    : arcLabelPlacement(monthMidAngle(month), (innerR + outerR) / 2);

  const monthLabel = getMonthNameShort(month, locale);
  const fill = hovered ? MONTH_COLORS_HOVER[month] : MONTH_COLORS[month];

  // Check if this month is in the selected range
  const isInSelectedRange =
    selectedRange !== null &&
    isInRange({ year, month, day: 1 }, {
      start: { ...selectedRange.start, day: 1 },
      end: { ...selectedRange.end, day: selectedRange.end.day },
    }) &&
    (selectedRange.start.year < year ||
      (selectedRange.start.year === year && selectedRange.start.month <= month)) &&
    (selectedRange.end.year > year ||
      (selectedRange.end.year === year && selectedRange.end.month >= month));

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
      <path d={pathD} fill={fill} stroke="white" strokeWidth={0.8} />

      {(isSelected || isInSelectedRange) && (
        <path d={pathD} fill={SELECTION_FILL} stroke="none" pointerEvents="none" />
      )}

      <text
        x={label.x}
        y={label.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontFamily="system-ui, sans-serif"
        fill="#333"
        fontWeight="500"
        transform={`rotate(${label.rotation}, ${label.x}, ${label.y})`}
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {monthLabel}
      </text>
    </g>
  );
};
