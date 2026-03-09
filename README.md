# 🌀 Spiral Calendar

A radial/spiral calendar web app built with React and TypeScript. Visualize years, months, and days as concentric rings or an Archimedean spiral — with full event & task management, date range selection, and multilingual support.

## ✨ Features

### Calendar Views
| View | Description |
|------|-------------|
| **All Years** | 5 rings (current year ± 2), each divided into 12 month sectors |
| **Year** | Single ring with all 12 months |
| **Month** | Traditional grid calendar (Mon–Sun) |
| **Week** | Radial arc with each day of the week |

### Two Display Modes
- **Circular** — classic concentric rings centered on the same origin
- **Spiral** — true Archimedean spiral where each revolution = one year, bands grow outward

### Date Selection
- **Single** mode — click any day to select it; click again to deselect
- **Range** mode — click start date, hover to preview, click end date to confirm

### Events & Tasks
- Add **Events** (with optional time range and reminder) or **Tasks** (with completion checkbox)
- Events persist across sessions via `localStorage`
- 8 color options per item
- Reminder offset selector (5 min → 1 day before)

### Visualization on the Spiral
- **Long events** (spanning >1 month) render as a thick colored arc along the outer edge of each affected year band
- **Short/single-day events** appear as colored dots at the month's angular position
- Completed items render at reduced opacity

### Other
- 🌍 Localization: **English**, **Russian**, **Ukrainian**
- ⌨️ Breadcrumb navigation (All Years › 2026 › March)
- ↩️ Full zoom history with Back button
- 🎨 Seasonal pastel colors per month (winter blues → summer yellows → autumn oranges)
- 📱 Responsive layout

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20.19+ or 22.12+
- npm

### Install & run

```bash
git clone https://github.com/pavlionix/spiral-calendar.git
cd spiral-calendar
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
npm run build    # type-check + Vite bundle → dist/
npm run preview  # serve the production build locally
```

---

## 🗂 Project Structure

```
src/
├── types/           # Shared TypeScript interfaces (CalendarDate, CalendarEvent, …)
├── constants/       # SVG geometry params, month colors, event color palette
├── utils/
│   ├── geometry.ts  # Polar ↔ cartesian, sector paths, spiral math
│   ├── dateUtils.ts # date-fns wrappers (weeks, ranges, ISO week numbers)
│   ├── eventUtils.ts# Event filtering, arc segment helpers
│   └── localization.ts # Month/weekday names, date formatting (EN/RU/UK)
├── store/           # Zustand store — view state, selection, events (localStorage)
├── hooks/           # useAnimatedTransition (zoom fade/scale)
└── components/
    ├── SpiralCalendar/    # Root SVG + YearsView, YearView, MonthView, WeekView
    ├── CalendarRing/      # One year's ring of 12 MonthSectors
    ├── MonthSector/       # Single 30° sector (circular or spiral path)
    ├── DayArc/            # Single day arc in week view
    ├── CalendarControls/  # Back · Today · Reset · Mode · View · Language
    ├── ZoomNavigation/    # Breadcrumb bar
    ├── InfoPanel/         # Selected date / range info card
    ├── DayPanel/          # Sidebar: events for selected day + task checkboxes
    └── EventForm/         # Modal form for adding / editing events & tasks
```

---

## 🛠 Tech Stack

| Library | Version | Role |
|---------|---------|------|
| [React](https://react.dev) | 19 | UI |
| [TypeScript](https://www.typescriptlang.org) | 5 | Type safety |
| [Vite](https://vite.dev) | 7 | Build tool & dev server |
| [Zustand](https://zustand-demo.pmnd.rs) | 5 | State management |
| [date-fns](https://date-fns.org) | 4 | Date utilities & localization |

---

## 🎯 How to Use

### Navigating
- **Click a month sector** in the years or year view → zoom into that month's grid
- **Click a day** in the month grid → opens the Day Panel for that day
- **Out-of-month cells** (grayed) → navigate to that month
- Use the **breadcrumb bar** at the top or the **Back** button to go up

### Adding Events
1. Click any day in the month grid
2. Click **"+ Add event or task"** in the Day Panel
3. Fill in the title, choose Event or Task, set dates/times, pick a color
4. Click **Add**

### Completing Tasks
- In the Day Panel, click the circle ○ next to a task → it turns into a ✓ checkmark and the title is struck through
- On the spiral, completed items automatically dim

### Switching Views
Use the **View** toggle in the controls panel:
- **Circular** — independent concentric rings per year
- **Spiral** — continuous Archimedean spiral, years grow outward from center

### Changing Language
Click **EN / RU / UK** in the controls panel — all month names, weekday headers, and UI strings update instantly.

---

## 📐 Spiral Math

The spiral uses an **Archimedean spiral** `r(θ) = a + b·θ` where:
- All 12 months share the same angular positions (January at 12 o'clock, clockwise)
- Year N's band occupies `r_inner(α) = a + b·(α + N·2π)` to `r_outer = r_inner + b·2π`
- Band width `b·2π` is constant — consecutive year bands are seamlessly adjacent
- Parameters `a` and `b` are computed dynamically so the outermost band fits exactly within the SVG viewport

---

## License

MIT
