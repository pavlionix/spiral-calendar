import { format } from 'date-fns';
import { enUS, ru, uk } from 'date-fns/locale';
import type { Locale } from '../types/calendar';

const LOCALE_MAP = {
  en: enUS,
  ru: ru,
  uk: uk,
};

function getDateFnsLocale(locale: Locale) {
  return LOCALE_MAP[locale];
}

export function getMonthName(month: number, locale: Locale): string {
  const date = new Date(2024, month - 1, 1);
  return format(date, 'LLLL', { locale: getDateFnsLocale(locale) });
}

export function getMonthNameShort(month: number, locale: Locale): string {
  const date = new Date(2024, month - 1, 1);
  return format(date, 'LLL', { locale: getDateFnsLocale(locale) });
}

export function getWeekdayName(dow: number, locale: Locale): string {
  // dow: 0=Sunday, 1=Monday, ..., 6=Saturday
  const date = new Date(2024, 0, 7 + dow); // Jan 7 2024 = Sunday
  return format(date, 'EEEE', { locale: getDateFnsLocale(locale) });
}

// dow: 0=Monday, 1=Tuesday, ..., 6=Sunday (ISO order for grid headers)
export function getWeekdayShort(dow: number, locale: Locale): string {
  // Jan 1 2024 is Monday → offset by dow days
  const date = new Date(2024, 0, 1 + dow);
  return format(date, 'EEEEEE', { locale: getDateFnsLocale(locale) });
}

export function formatCalendarDate(
  date: { year: number; month: number; day: number },
  locale: Locale
): string {
  const d = new Date(date.year, date.month - 1, date.day);
  if (locale === 'en') {
    return format(d, 'MMMM d, yyyy', { locale: getDateFnsLocale(locale) });
  }
  return format(d, 'd MMMM yyyy', { locale: getDateFnsLocale(locale) });
}

type UIKey =
  | 'back'
  | 'today'
  | 'reset'
  | 'singleMode'
  | 'rangeMode'
  | 'circular'
  | 'spiral'
  | 'clickToSetEnd'
  | 'totalDays'
  | 'allYears'
  | 'week'
  | 'selectedDate'
  | 'selectedRange';

const UI_STRINGS: Record<UIKey, Record<Locale, string>> = {
  back:         { en: 'Back',         ru: 'Назад',      uk: 'Назад'      },
  today:        { en: 'Today',        ru: 'Сегодня',    uk: 'Сьогодні'   },
  reset:        { en: 'Reset',        ru: 'Сброс',      uk: 'Скинути'    },
  singleMode:   { en: 'Single',       ru: 'Один',       uk: 'Один'       },
  rangeMode:    { en: 'Range',        ru: 'Период',     uk: 'Діапазон'   },
  circular:     { en: 'Circular',     ru: 'Кольцо',     uk: 'Кільце'     },
  spiral:       { en: 'Spiral',       ru: 'Спираль',    uk: 'Спіраль'    },
  clickToSetEnd:{ en: 'Click to set end date', ru: 'Нажмите для выбора конечной даты', uk: 'Натисніть для вибору кінцевої дати' },
  totalDays:    { en: 'days',         ru: 'дней',       uk: 'днів'       },
  allYears:     { en: 'All Years',    ru: 'Все годы',   uk: 'Всі роки'   },
  week:         { en: 'Week',         ru: 'Неделя',     uk: 'Тиждень'    },
  selectedDate: { en: 'Selected date',ru: 'Выбрана дата',uk: 'Обрана дата'},
  selectedRange:{ en: 'Selected range',ru: 'Выбран период',uk: 'Обраний діапазон'},
};

export function t(key: UIKey, locale: Locale): string {
  return UI_STRINGS[key][locale] ?? UI_STRINGS[key]['en'];
}
