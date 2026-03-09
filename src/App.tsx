import { SpiralCalendar } from './components/SpiralCalendar';
import { CalendarControls } from './components/CalendarControls';
import { ZoomNavigation } from './components/ZoomNavigation';
import { InfoPanel } from './components/InfoPanel';
import { DayPanel } from './components/DayPanel';
import { EventForm } from './components/EventForm';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Spiral Calendar</h1>
        <ZoomNavigation />
      </header>

      <main className="app-main">
        <div className="calendar-wrapper">
          <SpiralCalendar />
        </div>

        <aside className="app-sidebar">
          <CalendarControls />
          <DayPanel />
          <InfoPanel />
        </aside>
      </main>

      {/* Global overlays */}
      <EventForm />
    </div>
  );
}

export default App;
