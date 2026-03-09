import { create } from 'zustand';
import type {
  CalendarStore, CalendarDate, SelectionMode, ViewMode, Locale,
  ZoomLevel, CalendarEvent,
} from '../types/calendar';
import { calendarDatesEqual, normalizeRange, today } from '../utils/dateUtils';
import { EVENT_COLORS } from '../constants/colors';

// ── localStorage persistence ─────────────────────────────────────────────────
const EVENTS_KEY = 'spiral-calendar-events';

function loadEvents(): CalendarEvent[] {
  try { return JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]'); }
  catch { return []; }
}

function saveEvents(events: CalendarEvent[]): void {
  try { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); }
  catch { /* ignore */ }
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function getInitialYear() { return new Date().getFullYear(); }

type ZoomTarget = {
  zoomLevel: ZoomLevel;
  focusedYear: number;
  focusedMonth: number | null;
  focusedWeek: number | null;
};

function currentSnapshot(s: CalendarStore): ZoomTarget {
  return {
    zoomLevel: s.zoomLevel,
    focusedYear: s.focusedYear,
    focusedMonth: s.focusedMonth,
    focusedWeek: s.focusedWeek,
  };
}

// ── store ────────────────────────────────────────────────────────────────────
export const useCalendarStore = create<CalendarStore>()((set) => ({
  // View state
  zoomLevel: 'years',
  focusedYear: getInitialYear(),
  focusedMonth: null,
  focusedWeek: null,
  history: [],

  // Selection state
  selectionMode: 'single',
  selectedDate: null,
  selectedRange: null,
  rangeAnchor: null,
  hoverDate: null,

  // Display
  viewMode: 'circular',
  locale: 'en',

  // Events
  events: loadEvents(),
  selectedDay: null,
  formDate: null,
  editingEvent: null,

  // ── navigation ─────────────────────────────────────────────────────────────
  zoomIn: ({ year, month, week }) =>
    set((s) => ({
      history: [...s.history, currentSnapshot(s)],
      zoomLevel: week !== undefined ? 'week' : month !== undefined ? 'month' : 'year',
      focusedYear: year,
      focusedMonth: month ?? null,
      focusedWeek: week ?? null,
    })),

  goBack: () =>
    set((s) => {
      const prev = s.history[s.history.length - 1];
      if (!prev) return s;
      return {
        ...prev,
        history: s.history.slice(0, -1),
        selectionMode: s.selectionMode,
        selectedDate: s.selectedDate,
        selectedRange: s.selectedRange,
        rangeAnchor: s.rangeAnchor,
        hoverDate: s.hoverDate,
        viewMode: s.viewMode,
        locale: s.locale,
        events: s.events,
        selectedDay: s.selectedDay,
        formDate: s.formDate,
        editingEvent: s.editingEvent,
      };
    }),

  goToToday: () =>
    set((s) => {
      const t = today();
      return {
        history: [...s.history, currentSnapshot(s)],
        zoomLevel: 'month',
        focusedYear: t.year,
        focusedMonth: t.month,
        focusedWeek: null,
        selectedDay: t,
      };
    }),

  resetView: () =>
    set(() => {
      const t = today();
      return {
        zoomLevel: 'year',
        focusedYear: t.year,
        focusedMonth: null,
        focusedWeek: null,
        history: [],
        selectedDate: null,
        selectedRange: null,
        rangeAnchor: null,
        hoverDate: null,
        selectedDay: null,
        formDate: null,
        editingEvent: null,
      };
    }),

  // ── selection ──────────────────────────────────────────────────────────────
  selectDate: (date: CalendarDate) =>
    set((s) => {
      if (s.selectionMode === 'single') {
        return {
          selectedDate: calendarDatesEqual(s.selectedDate, date) ? null : date,
          selectedRange: null,
          rangeAnchor: null,
        };
      }
      if (s.rangeAnchor === null) {
        return { rangeAnchor: date, selectedRange: null, selectedDate: null };
      }
      return {
        selectedRange: normalizeRange(s.rangeAnchor, date),
        rangeAnchor: null,
        selectedDate: null,
      };
    }),

  setHoverDate: (date) => set(() => ({ hoverDate: date })),

  setSelectionMode: (mode: SelectionMode) =>
    set(() => ({
      selectionMode: mode,
      selectedDate: null,
      selectedRange: null,
      rangeAnchor: null,
      hoverDate: null,
    })),

  clearSelection: () =>
    set(() => ({
      selectedDate: null,
      selectedRange: null,
      rangeAnchor: null,
      hoverDate: null,
    })),

  setViewMode: (mode: ViewMode) => set(() => ({ viewMode: mode })),
  setLocale: (locale: Locale) => set(() => ({ locale })),

  // ── day panel ──────────────────────────────────────────────────────────────
  setSelectedDay: (date) => set(() => ({ selectedDay: date })),

  // ── event form ─────────────────────────────────────────────────────────────
  openNewEvent: (date) => set(() => ({ formDate: date, editingEvent: null })),
  openEditEvent: (event) => set(() => ({ editingEvent: event, formDate: null })),
  closeEventForm: () => set(() => ({ formDate: null, editingEvent: null })),

  // ── event CRUD ─────────────────────────────────────────────────────────────
  addEvent: (e) =>
    set((s) => {
      const newEvent: CalendarEvent = { ...e, id: makeId(), completed: false };
      const events = [...s.events, newEvent];
      saveEvents(events);
      return { events, formDate: null, editingEvent: null };
    }),

  updateEvent: (id, updates) =>
    set((s) => {
      const events = s.events.map((e) => (e.id === id ? { ...e, ...updates } : e));
      saveEvents(events);
      return { events, formDate: null, editingEvent: null };
    }),

  deleteEvent: (id) =>
    set((s) => {
      const events = s.events.filter((e) => e.id !== id);
      saveEvents(events);
      return { events };
    }),

  toggleComplete: (id) =>
    set((s) => {
      const events = s.events.map((e) =>
        e.id === id ? { ...e, completed: !e.completed } : e
      );
      saveEvents(events);
      return { events };
    }),
}));

// Default color for new events (cycles through palette)
export function nextEventColor(events: CalendarEvent[]): string {
  return EVENT_COLORS[events.length % EVENT_COLORS.length];
}
