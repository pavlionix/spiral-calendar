export type ZoomLevel = 'years' | 'year' | 'month' | 'week';
export type ViewMode = 'circular' | 'spiral';
export type SelectionMode = 'single' | 'range';
export type Locale = 'en' | 'ru' | 'uk';
export type EventType = 'event' | 'task';

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface DateRange {
  start: CalendarDate;
  end: CalendarDate;
}

export interface HistoryEntry {
  zoomLevel: ZoomLevel;
  focusedYear: number;
  focusedMonth: number | null;
  focusedWeek: number | null;
}

export interface ViewState {
  zoomLevel: ZoomLevel;
  focusedYear: number;
  focusedMonth: number | null;
  focusedWeek: number | null;
  history: HistoryEntry[];
}

export interface SelectionState {
  selectionMode: SelectionMode;
  selectedDate: CalendarDate | null;
  selectedRange: DateRange | null;
  rangeAnchor: CalendarDate | null;
  hoverDate: CalendarDate | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  startDate: CalendarDate;
  endDate: CalendarDate;
  startTime: string;      // "HH:MM" or ""
  endTime: string;        // "HH:MM" or ""
  reminder: boolean;
  reminderMinutes: number;
  completed: boolean;
  color: string;
}

export interface CalendarStore extends ViewState, SelectionState {
  viewMode: ViewMode;
  locale: Locale;

  // Events
  events: CalendarEvent[];
  selectedDay: CalendarDate | null;
  formDate: CalendarDate | null;    // pre-fill date when opening new event form
  editingEvent: CalendarEvent | null;

  zoomIn: (params: { year: number; month?: number; week?: number }) => void;
  goBack: () => void;
  goToToday: () => void;
  resetView: () => void;
  selectDate: (date: CalendarDate) => void;
  setHoverDate: (date: CalendarDate | null) => void;
  setSelectionMode: (mode: SelectionMode) => void;
  clearSelection: () => void;
  setViewMode: (mode: ViewMode) => void;
  setLocale: (locale: Locale) => void;

  // Day panel
  setSelectedDay: (date: CalendarDate | null) => void;

  // Event CRUD
  openNewEvent: (date: CalendarDate) => void;
  openEditEvent: (event: CalendarEvent) => void;
  closeEventForm: () => void;
  addEvent: (e: Omit<CalendarEvent, 'id' | 'completed'>) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  toggleComplete: (id: string) => void;
}
