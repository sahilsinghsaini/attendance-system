import { useEffect, useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Plus,
  Search,
  Sparkles,
  Clock,
  PartyPopper,
  Tag,
  Building,
  CheckCircle2,
  CalendarDays,
  X,
  FileText,
  Printer
} from 'lucide-react';
import { api } from '../services/api';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: 'PUBLIC_HOLIDAY' | 'FESTIVAL' | 'ANNUAL_DAY' | 'RESTRICTED_HOLIDAY';
  office_status: 'CLOSED' | 'WORKING_CELEBRATION' | 'OPTIONAL' | 'HALF_DAY';
  description?: string;
  is_long_weekend?: boolean;
  is_custom?: boolean;
}

const DEFAULT_EVENTS_DATA: CalendarEvent[] = [
  // 2026 Holidays, Festivals, & Annual Days
  {
    id: '2026-01-01',
    title: "New Year's Day",
    date: '2026-01-01',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Celebration of the New Year 2026. Paid public holiday. All corporate offices are closed.',
    is_long_weekend: false,
  },
  {
    id: '2026-01-14',
    title: 'Makar Sankranti / Pongal',
    date: '2026-01-14',
    category: 'FESTIVAL',
    office_status: 'OPTIONAL',
    description: 'Harvest festival marking the sun transition into Capricorn (Makara). Celebrated with traditional sweets and kite flying.',
    is_long_weekend: false,
  },
  {
    id: '2026-01-26',
    title: 'Republic Day',
    date: '2026-01-26',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'National holiday commemorating the adoption of the Constitution of India in 1950. 3-day long weekend.',
    is_long_weekend: true,
  },
  {
    id: '2026-02-15',
    title: 'Maha Shivratri',
    date: '2026-02-15',
    category: 'FESTIVAL',
    office_status: 'OPTIONAL',
    description: 'Major sacred festival celebrated in honor of Lord Shiva, symbolizing meditation, spiritual awakening, and inner peace.',
    is_long_weekend: false,
  },
  {
    id: '2026-03-03',
    title: 'Holi (Festival of Colors)',
    date: '2026-03-03',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Vibrant festival celebrating the triumph of good over evil, arrival of spring, and unity with organic colors.',
    is_long_weekend: false,
  },
  {
    id: '2026-03-20',
    title: 'Eid-ul-Fitr',
    date: '2026-03-20',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Islamic festival marking the conclusion of the holy month of Ramadan with feasts, charitable giving, and family gatherings. 3-day weekend.',
    is_long_weekend: true,
  },
  {
    id: '2026-04-03',
    title: 'Good Friday',
    date: '2026-04-03',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Christian holy day commemorating the crucifixion of Jesus Christ. Observed with solemn prayers and reflection. 3-day long weekend.',
    is_long_weekend: true,
  },
  {
    id: '2026-05-27',
    title: 'Eid al-Adha (Bakrid)',
    date: '2026-05-27',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Feast of the Sacrifice honoring the willingness of Ibrahim to sacrifice his son in obedience to God. Observed with special prayers and communal sharing.',
    is_long_weekend: false,
  },
  {
    id: '2026-08-15',
    title: 'Independence Day',
    date: '2026-08-15',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'National holiday commemorating the declaration of Indian Independence in 1947. Ceremonial flag hoisting and patriotic observances.',
    is_long_weekend: false,
  },
  {
    id: '2026-08-28',
    title: 'Raksha Bandhan',
    date: '2026-08-28',
    category: 'FESTIVAL',
    office_status: 'OPTIONAL',
    description: 'Traditional festival celebrating the sacred bond of mutual love, protection, and care between brothers and sisters. 3-day long weekend.',
    is_long_weekend: true,
  },
  {
    id: '2026-09-04',
    title: 'Janmashtami',
    date: '2026-09-04',
    category: 'FESTIVAL',
    office_status: 'OPTIONAL',
    description: 'Joyful celebration marking the birth of Lord Krishna with devotional music, fasting, and Dahi Handi festivities. 3-day long weekend.',
    is_long_weekend: true,
  },
  {
    id: '2026-09-15',
    title: 'Tobatax Annual Tech & Innovation Day',
    date: '2026-09-15',
    category: 'ANNUAL_DAY',
    office_status: 'WORKING_CELEBRATION',
    description: 'Annual corporate innovation fair, internal hackathon presentations, tech leadership keynote, and recognition of technical excellence.',
    is_long_weekend: false,
  },
  {
    id: '2026-10-02',
    title: 'Mahatma Gandhi Jayanti',
    date: '2026-10-02',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'National holiday commemorating the birth anniversary of Mahatma Gandhi, pioneer of non-violence (Ahimsa) and freedom. 3-day weekend.',
    is_long_weekend: true,
  },
  {
    id: '2026-10-20',
    title: 'Dussehra (Vijayadashami)',
    date: '2026-10-20',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Major Hindu festival celebrating the victory of Lord Rama over the demon king Ravana, affirming righteousness over oppression.',
    is_long_weekend: false,
  },
  {
    id: '2026-11-08',
    title: 'Diwali (Deepavali)',
    date: '2026-11-08',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'The spectacular Festival of Lights celebrating wealth, prosperity, knowledge, and inner light with clay diyas and fireworks.',
    is_long_weekend: false,
  },
  {
    id: '2026-11-09',
    title: 'Govardhan Puja / Vikram Samvat New Year',
    date: '2026-11-09',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Celebrated on the day following Diwali with Annakut food offerings and ceremonial opening of business accounting books. 3-day weekend.',
    is_long_weekend: true,
  },
  {
    id: '2026-11-24',
    title: 'Guru Nanak Jayanti (Gurpurab)',
    date: '2026-11-24',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Birth anniversary of Guru Nanak Dev Ji, founder of Sikhism. Celebrated with morning processions (Prabhat Pheris) and community kitchen (Langar).',
    is_long_weekend: false,
  },
  {
    id: '2026-12-18',
    title: 'Tobatax Annual Gala & Awards Night',
    date: '2026-12-18',
    category: 'ANNUAL_DAY',
    office_status: 'WORKING_CELEBRATION',
    description: 'Our premier annual party! Gala dinner, recognition of outstanding contributors, team performances, games, and year-end celebrations. 3-day weekend.',
    is_long_weekend: true,
  },
  {
    id: '2026-12-25',
    title: 'Christmas Day',
    date: '2026-12-25',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Joyous holiday celebrating the nativity of Jesus Christ. Office secret Santa, festive trees, and seasonal cheer. 3-day long weekend.',
    is_long_weekend: true,
  },
  // 2025 Events
  {
    id: '2025-01-26',
    title: 'Republic Day',
    date: '2025-01-26',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'National holiday commemorating the Constitution of India.',
    is_long_weekend: false,
  },
  {
    id: '2025-03-14',
    title: 'Holi',
    date: '2025-03-14',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Festival of colors and celebration of spring.',
    is_long_weekend: true,
  },
  {
    id: '2025-07-15',
    title: 'Tobatax Annual Foundation Day',
    date: '2025-07-15',
    category: 'ANNUAL_DAY',
    office_status: 'WORKING_CELEBRATION',
    description: 'Tobatax founding anniversary and annual team assembly.',
    is_long_weekend: false,
  },
  {
    id: '2025-08-15',
    title: 'Independence Day',
    date: '2025-08-15',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Independence Day celebration and national holiday.',
    is_long_weekend: true,
  },
  {
    id: '2025-10-20',
    title: 'Diwali',
    date: '2025-10-20',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Auspicious festival of lights.',
    is_long_weekend: true,
  },
  {
    id: '2025-12-25',
    title: 'Christmas Day',
    date: '2025-12-25',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Global Christmas holiday.',
    is_long_weekend: false,
  },
  // 2027 Events
  {
    id: '2027-01-01',
    title: "New Year's Day",
    date: '2027-01-01',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Welcome to 2027! 3-day long weekend.',
    is_long_weekend: true,
  },
  {
    id: '2027-01-26',
    title: 'Republic Day',
    date: '2027-01-26',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: '78th Republic Day celebration.',
    is_long_weekend: false,
  },
  {
    id: '2027-07-15',
    title: 'Tobatax Annual Foundation Day',
    date: '2027-07-15',
    category: 'ANNUAL_DAY',
    office_status: 'WORKING_CELEBRATION',
    description: 'Tobatax annual milestone and company celebration.',
    is_long_weekend: false,
  },
  {
    id: '2027-08-15',
    title: 'Independence Day',
    date: '2027-08-15',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'National Independence day celebration.',
    is_long_weekend: false,
  },
  {
    id: '2027-10-29',
    title: 'Diwali',
    date: '2027-10-29',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Grand Festival of Lights celebrations.',
    is_long_weekend: true,
  },
  {
    id: '2027-12-25',
    title: 'Christmas Day',
    date: '2027-12-25',
    category: 'PUBLIC_HOLIDAY',
    office_status: 'CLOSED',
    description: 'Christmas Day celebration.',
    is_long_weekend: false,
  },
];

// Keep explicitly removed organization holidays hidden even when they are
// present in stale backend responses or this browser's saved custom events.
const REMOVED_HOLIDAY_DATES = new Set(['2026-11-09', '2026-11-18']);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Calendar() {
  const role = localStorage.getItem('role');
  const isSuperAdmin = role === 'SUPER_ADMIN';

  // State
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(new Date().getMonth());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // New Event Form
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    category: 'ANNUAL_DAY' as CalendarEvent['category'],
    office_status: 'WORKING_CELEBRATION' as CalendarEvent['office_status'],
    description: '',
    is_long_weekend: false,
  });

  // Load events
  useEffect(() => {
    async function loadEvents() {
      // Organization holidays are shared; the backend is the source of truth.
      try {
        const apiEvents = await api(`/holidays?year=${selectedYear}`);
        if (Array.isArray(apiEvents)) {
          setEvents(apiEvents.filter((event: CalendarEvent) => !REMOVED_HOLIDAY_DATES.has(event.date)));
          return;
        }
      } catch {
        // Fallback gracefully to default events dataset
      }

      // Default events fallback
      const filteredDefaults = DEFAULT_EVENTS_DATA.filter(e =>
        e.date.startsWith(`${selectedYear}-`) && !REMOVED_HOLIDAY_DATES.has(e.date)
      );
      setEvents(filteredDefaults);
    }

    loadEvents();
  }, [selectedYear]);

  // Today ISO string
  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      // Category filter
      if (selectedCategory !== 'ALL' && e.category !== selectedCategory) {
        return false;
      }
      // Month filter
      if (selectedMonthFilter !== 'ALL') {
        const eventMonth = parseInt(e.date.split('-')[1], 10) - 1;
        if (eventMonth !== parseInt(selectedMonthFilter, 10)) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = e.title.toLowerCase().includes(q);
        const matchesDesc = (e.description || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [events, selectedCategory, selectedMonthFilter, searchQuery]);

  // Map of events keyed by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach(e => {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    });
    return map;
  }, [events]);

  // Next upcoming holiday spotlight
  const nextUpcomingEvent = useMemo(() => {
    const future = events
      .filter(e => e.date >= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date));
    return future[0] || null;
  }, [events, todayIso]);

  // Stats counters for current year
  const stats = useMemo(() => {
    const total = events.length;
    const publicHolidays = events.filter(e => e.category === 'PUBLIC_HOLIDAY').length;
    const festivals = events.filter(e => e.category === 'FESTIVAL').length;
    const annualDays = events.filter(e => e.category === 'ANNUAL_DAY').length;
    const upcoming = events.filter(e => e.date >= todayIso).length;
    return { total, publicHolidays, festivals, annualDays, upcoming };
  }, [events, todayIso]);

  // Calendar Grid Calculation for Current Month
  const calendarDays = useMemo(() => {
    const year = selectedYear;
    const month = currentMonthIndex;

    // First day of current month
    const firstDay = new Date(year, month, 1);
    // 0 = Sunday, 1 = Monday... convert to Monday = 0
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday becomes 6

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      isToday: boolean;
      events: CalendarEvent[];
    }> = [];

    // Previous month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayOfWeek = new Date(prevYear, prevMonth, dayNum).getDay();
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: dateStr === todayIso,
        events: eventsByDate.get(dateStr) || [],
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: dateStr === todayIso,
        events: eventsByDate.get(dateStr) || [],
      });
    }

    // Next month padding to fill complete weeks (up to 35 or 42 cells)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let n = 1; n <= remaining; n++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
      const dayOfWeek = new Date(nextYear, nextMonth, n).getDay();
      days.push({
        dateStr,
        dayNumber: n,
        isCurrentMonth: false,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: dateStr === todayIso,
        events: eventsByDate.get(dateStr) || [],
      });
    }

    return days;
  }, [selectedYear, currentMonthIndex, todayIso, eventsByDate]);

  // Selected Date events
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDate.get(selectedDate) || [];
  }, [selectedDate, eventsByDate]);

  // Helper formatting
  function formatDatePretty(isoDate: string) {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function getDaysUntil(isoDate: string) {
    const today = new Date(todayIso);
    const target = new Date(isoDate);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Happening today!';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    return `In ${diffDays} days`;
  }

  function getCategoryBadge(category: CalendarEvent['category']) {
    switch (category) {
      case 'PUBLIC_HOLIDAY':
        return <span className="cal-badge badge-public">🏛️ Public Holiday</span>;
      case 'FESTIVAL':
        return <span className="cal-badge badge-festival">✨ Festival</span>;
      case 'ANNUAL_DAY':
        return <span className="cal-badge badge-annual">🏢 Annual Day</span>;
      case 'RESTRICTED_HOLIDAY':
        return <span className="cal-badge badge-restricted">📌 Optional / Restricted</span>;
      default:
        return <span className="cal-badge">Holiday</span>;
    }
  }

  function getOfficeStatusBadge(status: CalendarEvent['office_status']) {
    switch (status) {
      case 'CLOSED':
        return <span className="cal-status-badge status-closed">Office Closed (Paid Holiday)</span>;
      case 'WORKING_CELEBRATION':
        return <span className="cal-status-badge status-celebration">Company Celebration Day</span>;
      case 'OPTIONAL':
        return <span className="cal-status-badge status-optional">Optional / Restricted Leave</span>;
      case 'HALF_DAY':
        return <span className="cal-status-badge status-half">Half Day Celebration</span>;
      default:
        return null;
    }
  }

  // Navigation handlers
  function handlePrevMonth() {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setSelectedYear(y => y - 1);
    } else {
      setCurrentMonthIndex(m => m - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setSelectedYear(y => y + 1);
    } else {
      setCurrentMonthIndex(m => m + 1);
    }
  }

  function handleJumpToToday() {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setCurrentMonthIndex(now.getMonth());
    setSelectedDate(todayIso);
  }

  // Generate & Download iCalendar file (.ics)
  function exportToICal(eventList: CalendarEvent[], filename = 'tobatax-holidays.ics') {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tobatax//Attendance System Holidays//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Tobatax Holidays & Celebrations',
      'X-WR-TIMEZONE:Asia/Kolkata',
    ];

    eventList.forEach(e => {
      const dateClean = e.date.replace(/-/g, '');
      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:${e.id}@tobacentral.com`);
      icsContent.push(`DTSTAMP:${dateClean}T000000Z`);
      icsContent.push(`DTSTART;VALUE=DATE:${dateClean}`);
      icsContent.push(`SUMMARY:${e.title}`);
      icsContent.push(`DESCRIPTION:${(e.description || '').replace(/\n/g, '\\n')}`);
      icsContent.push(`CATEGORIES:${e.category}`);
      icsContent.push('STATUS:CONFIRMED');
      icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Create or update a shared organization holiday.
  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!isSuperAdmin || !newEvent.title.trim() || !newEvent.date) return;
    const payload = {
      ...newEvent,
      title: newEvent.title.trim(),
      description: newEvent.description.trim() || undefined,
    };
    try {
      const savedEvent: CalendarEvent = await api(editingEvent ? `/holidays/${encodeURIComponent(editingEvent.id)}` : '/holidays', {
        method: editingEvent ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setEvents(prev => editingEvent
        ? prev.map(event => event.id === editingEvent.id ? savedEvent : event)
        : [...prev, savedEvent]);
      setSelectedYear(Number(savedEvent.date.slice(0, 4)));
      setCurrentMonthIndex(Number(savedEvent.date.slice(5, 7)) - 1);
      setSelectedDate(savedEvent.date);
      setShowAddModal(false);
      setEditingEvent(null);
      setNewEvent({ title: '', date: '', category: 'ANNUAL_DAY', office_status: 'WORKING_CELEBRATION', description: '', is_long_weekend: false });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not save the holiday. Please try again.');
    }
  }

  function startEditingEvent(event: CalendarEvent) {
    setEditingEvent(event);
    setNewEvent({
      title: event.title,
      date: event.date,
      category: event.category,
      office_status: event.office_status,
      description: event.description || '',
      is_long_weekend: Boolean(event.is_long_weekend),
    });
    setShowAddModal(true);
  }

  // Delete from the shared organization calendar.
  async function handleDeleteEvent(id: string) {
    if (!window.confirm('Are you sure you want to remove this holiday from the calendar? This cannot be undone.')) return;
    try {
      await api(`/holidays/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setEvents(prev => prev.filter(event => event.id !== id));
      if (selectedDate && (eventsByDate.get(selectedDate) || []).some(event => event.id === id)) {
        setSelectedDate(null);
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not remove the holiday. Please try again.');
    }
  }

  return (
    <div className="calendar-page-container">
      {/* Background illustration */}
      <div className="dashboard-bg-illustration cal-illustration">
        <img src="/assets/illustrations/accounting-work.png" alt="" />
      </div>

      {/* Header */}
      <header className="dashboard-header cal-page-header">
        <div>
          <p className="eyebrow">TOBATAX • COMPANY CALENDAR</p>
          <h2>Holidays & Festivals</h2>
          <p className="dashboard-subtitle">
            Official holidays, cultural festivals, and annual company events for {selectedYear}.
          </p>
        </div>

        <div className="cal-header-actions">
          <button
            type="button"
            className="cal-btn-outline"
            onClick={() => exportToICal(filteredEvents, `tobatax-holidays-${selectedYear}.ics`)}
            title="Download iCal file to import into Google Calendar or Apple Calendar"
          >
            <Download size={16} /> Export .ics
          </button>

          <button
            type="button"
            className="cal-btn-outline"
            onClick={() => window.print()}
            title="Print or save as PDF"
          >
            <Printer size={16} /> Print
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              className="cal-btn-primary"
              onClick={() => {
                setEditingEvent(null);
                setNewEvent({ title: '', date: '', category: 'ANNUAL_DAY', office_status: 'WORKING_CELEBRATION', description: '', is_long_weekend: false });
                setShowAddModal(true);
              }}
            >
              <Plus size={16} /> Add Company Event
            </button>
          )}
        </div>
      </header>

      {/* Next Upcoming Holiday Banner */}
      {nextUpcomingEvent && (
        <section className="card cal-spotlight-card">
          <div className="cal-spotlight-content">
            <div className="cal-spotlight-left">
              <div className="cal-spotlight-icon">
                {nextUpcomingEvent.category === 'PUBLIC_HOLIDAY' ? '🏛️' :
                 nextUpcomingEvent.category === 'FESTIVAL' ? '🎉' : '🏢'}
              </div>
              <div>
                <div className="cal-spotlight-eyebrow">
                  <span>UPCOMING NEXT</span> • {getDaysUntil(nextUpcomingEvent.date)}
                  {nextUpcomingEvent.is_long_weekend && (
                    <span className="cal-pill-tag tag-long-weekend">
                      <Sparkles size={12} /> 3-Day Weekend
                    </span>
                  )}
                </div>
                <h3 className="cal-spotlight-title">{nextUpcomingEvent.title}</h3>
                <p className="cal-spotlight-date">
                  📅 {formatDatePretty(nextUpcomingEvent.date)}
                </p>
                {nextUpcomingEvent.description && (
                  <p className="cal-spotlight-desc">{nextUpcomingEvent.description}</p>
                )}
              </div>
            </div>

            <div className="cal-spotlight-right">
              {getCategoryBadge(nextUpcomingEvent.category)}
              {getOfficeStatusBadge(nextUpcomingEvent.office_status)}
              <button
                type="button"
                className="cal-btn-sm"
                onClick={() => exportToICal([nextUpcomingEvent], `${nextUpcomingEvent.title.replace(/\s+/g, '_')}.ics`)}
              >
                <Download size={14} /> Add to Calendar
              </button>
            </div>
          </div>
        </section>
      )}

      {/* KPI Stats Grid */}
      <div className="cal-stats-grid">
        <div className="card cal-stat-box">
          <span>Total Holidays ({selectedYear})</span>
          <strong>{stats.total}</strong>
          <small className="cal-stat-hint">Official & company observances</small>
        </div>

        <div className="card cal-stat-box">
          <span>Public Holidays</span>
          <strong style={{ color: '#176b52' }}>{stats.publicHolidays}</strong>
          <small className="cal-stat-hint">Office closed (paid leave)</small>
        </div>

        <div className="card cal-stat-box">
          <span>Cultural Festivals</span>
          <strong style={{ color: '#7c3aed' }}>{stats.festivals}</strong>
          <small className="cal-stat-hint">Celebrated traditions</small>
        </div>

        <div className="card cal-stat-box">
          <span>Annual Company Days</span>
          <strong style={{ color: '#0284c7' }}>{stats.annualDays}</strong>
          <small className="cal-stat-hint">Foundation, Gala & Tech Days</small>
        </div>

        <div className="card cal-stat-box">
          <span>Remaining This Year</span>
          <strong style={{ color: '#ea580c' }}>{stats.upcoming}</strong>
          <small className="cal-stat-hint">Upcoming celebrations</small>
        </div>
      </div>

      {/* Control Bar: View Switcher, Year, Category & Search */}
      <div className="card cal-controls-card">
        <div className="cal-controls-row">
          {/* View mode toggle */}
          <div className="cal-toggle-group">
            <button
              type="button"
              className={viewMode === 'calendar' ? 'cal-toggle-btn active' : 'cal-toggle-btn'}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon size={16} /> Calendar View
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'cal-toggle-btn active' : 'cal-toggle-btn'}
              onClick={() => setViewMode('list')}
            >
              <FileText size={16} /> Full Holiday List
            </button>
          </div>

          {/* Year selector */}
          <div className="cal-year-selector">
            {[2025, 2026, 2027].map(yr => (
              <button
                key={yr}
                type="button"
                className={selectedYear === yr ? 'cal-year-btn active' : 'cal-year-btn'}
                onClick={() => setSelectedYear(yr)}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="cal-search-box">
            <Search size={16} className="cal-search-icon" />
            <input
              type="text"
              placeholder="Search festival or holiday..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="cal-clear-search"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="cal-filters-row">
          <div className="cal-filter-pills">
            <button
              type="button"
              className={selectedCategory === 'ALL' ? 'cal-pill active' : 'cal-pill'}
              onClick={() => setSelectedCategory('ALL')}
            >
              All Events ({events.length})
            </button>
            <button
              type="button"
              className={selectedCategory === 'PUBLIC_HOLIDAY' ? 'cal-pill active' : 'cal-pill'}
              onClick={() => setSelectedCategory('PUBLIC_HOLIDAY')}
            >
              🏛️ Public Holidays ({stats.publicHolidays})
            </button>
            <button
              type="button"
              className={selectedCategory === 'FESTIVAL' ? 'cal-pill active' : 'cal-pill'}
              onClick={() => setSelectedCategory('FESTIVAL')}
            >
              ✨ Festivals ({stats.festivals})
            </button>
            <button
              type="button"
              className={selectedCategory === 'ANNUAL_DAY' ? 'cal-pill active' : 'cal-pill'}
              onClick={() => setSelectedCategory('ANNUAL_DAY')}
            >
              🏢 Annual Company Days ({stats.annualDays})
            </button>
            <button
              type="button"
              className={selectedCategory === 'RESTRICTED_HOLIDAY' ? 'cal-pill active' : 'cal-pill'}
              onClick={() => setSelectedCategory('RESTRICTED_HOLIDAY')}
            >
              📌 Optional / Restricted
            </button>
          </div>

          {/* Month selector dropdown */}
          <div className="cal-month-select-wrapper">
            <select
              value={selectedMonthFilter}
              onChange={e => {
                setSelectedMonthFilter(e.target.value);
                if (e.target.value !== 'ALL') {
                  setCurrentMonthIndex(parseInt(e.target.value, 10));
                }
              }}
            >
              <option value="ALL">All Months</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main View: Calendar or List */}
      {viewMode === 'calendar' ? (
        <div className="cal-main-layout">
          {/* Calendar Grid Box */}
          <div className="card cal-grid-container">
            {/* Month Navigation */}
            <div className="cal-month-nav">
              <div className="cal-nav-left">
                <button
                  type="button"
                  className="cal-nav-arrow"
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3>
                  {MONTH_NAMES[currentMonthIndex]} {selectedYear}
                </h3>
                <button
                  type="button"
                  className="cal-nav-arrow"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="cal-nav-right">
                <button
                  type="button"
                  className="cal-today-btn"
                  onClick={handleJumpToToday}
                >
                  Jump to Today
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="cal-weekdays-row">
              {WEEKDAY_NAMES.map((wd, i) => (
                <div
                  key={wd}
                  className={`cal-weekday-label ${i >= 5 ? 'weekend-label' : ''}`}
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Day Cells Grid */}
            <div className="cal-days-grid">
              {calendarDays.map(day => {
                const isSelected = selectedDate === day.dateStr;
                const hasEvents = day.events.length > 0;
                const primaryEvent = day.events[0];

                return (
                  <div
                    key={day.dateStr}
                    className={`cal-day-cell ${
                      !day.isCurrentMonth ? 'other-month' : ''
                    } ${day.isWeekend ? 'weekend-cell' : ''} ${
                      day.isToday ? 'today-cell' : ''
                    } ${isSelected ? 'selected-cell' : ''} ${
                      hasEvents ? 'has-events' : ''
                    }`}
                    onClick={() => setSelectedDate(day.dateStr)}
                  >
                    <div className="cal-day-header">
                      <span className="cal-day-number">{day.dayNumber}</span>
                      {day.isToday && <span className="cal-today-badge">Today</span>}
                    </div>

                    {/* Events chips on the day */}
                    <div className="cal-day-events">
                      {day.events.slice(0, 2).map(ev => (
                        <div
                          key={ev.id}
                          className={`cal-event-chip cat-${ev.category.toLowerCase()}`}
                          title={`${ev.title} - ${ev.office_status}`}
                        >
                          <span className="cal-chip-dot"></span>
                          <span className="cal-chip-title">{ev.title}</span>
                        </div>
                      ))}
                      {day.events.length > 2 && (
                        <span className="cal-more-chip">
                          +{day.events.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="cal-legend">
              <span className="cal-legend-item">
                <span className="legend-dot public"></span> Public Holiday (Office Closed)
              </span>
              <span className="cal-legend-item">
                <span className="legend-dot festival"></span> Cultural Festival
              </span>
              <span className="cal-legend-item">
                <span className="legend-dot annual"></span> Annual Company Day
              </span>
              <span className="cal-legend-item">
                <span className="legend-dot optional"></span> Optional / Restricted
              </span>
            </div>
          </div>

          {/* Day Details / Inspector Side Panel */}
          <div className="card cal-inspector-card">
            <div className="cal-inspector-header">
              <CalendarDays size={20} className="cal-inspector-icon" />
              <div>
                <h4>
                  {selectedDate ? formatDatePretty(selectedDate) : 'Date Details'}
                </h4>
                <span className="cal-inspector-sub">
                  {selectedDate === todayIso ? '📍 Today' : 'Selected Date'}
                </span>
              </div>
            </div>

            <div className="cal-inspector-body">
              {selectedDateEvents.length > 0 ? (
                <div className="cal-inspector-events">
                  {selectedDateEvents.map(ev => (
                    <div key={ev.id} className="cal-detail-item">
                      <div className="cal-detail-top">
                        <h5>{ev.title}</h5>
                        {ev.is_long_weekend && (
                          <span className="cal-pill-tag tag-long-weekend">
                            🎉 3-Day Weekend
                          </span>
                        )}
                      </div>

                      <div className="cal-detail-tags">
                        {getCategoryBadge(ev.category)}
                        {getOfficeStatusBadge(ev.office_status)}
                      </div>

                      {ev.description && (
                        <p className="cal-detail-desc">{ev.description}</p>
                      )}

                      <div className="cal-detail-footer">
                          <button
                          type="button"
                          className="cal-btn-outline cal-btn-sm"
                          onClick={() => exportToICal([ev], `${ev.title.replace(/\s+/g, '_')}.ics`)}
                        >
                          <Download size={13} /> Export (.ics)
                        </button>
                        {isSuperAdmin && (
                          <button
                            type="button"
                            className="cal-btn-delete cal-btn-sm"
                            onClick={() => handleDeleteEvent(ev.id)}
                            title="Remove this holiday (Super Admin)"
                          >
                            <X size={13} /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cal-inspector-empty">
                  {selectedDate ? (
                    <>
                      <p className="cal-empty-text">No official holidays on this day.</p>
                      <p className="cal-empty-sub">Regular working day / scheduled shift.</p>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          className="cal-btn-outline cal-btn-sm"
                          style={{ marginTop: 16 }}
                          onClick={() => {
                            setEditingEvent(null);
                            setNewEvent(prev => ({ ...prev, date: selectedDate }));
                            setShowAddModal(true);
                          }}
                        >
                          <Plus size={14} /> Add Event on this Date
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="cal-empty-text">Click on any date in the calendar to view its holiday schedule.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List / Timeline View */
        <div className="cal-list-container">
          {filteredEvents.length === 0 ? (
            <div className="card cal-no-results">
              <h4>No holidays found matching your filters</h4>
              <p>Try resetting the category filter or searching with different terms.</p>
              <button
                type="button"
                className="cal-btn-outline"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedMonthFilter('ALL');
                  setSearchQuery('');
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            // Group events by Month
            MONTH_NAMES.map((monthName, mIdx) => {
              const monthEvents = filteredEvents.filter(e => {
                const em = parseInt(e.date.split('-')[1], 10) - 1;
                return em === mIdx;
              });

              if (monthEvents.length === 0) return null;

              return (
                <section key={monthName} className="cal-month-group">
                  <div className="cal-month-group-header">
                    <h3>{monthName} {selectedYear}</h3>
                    <span className="cal-group-count">
                      {monthEvents.length} {monthEvents.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>

                  <div className="cal-month-cards-grid">
                    {monthEvents.map(ev => {
                      const dayNum = ev.date.split('-')[2];
                      const dayDate = new Date(selectedYear, mIdx, parseInt(dayNum, 10));
                      const weekday = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                      const isPast = ev.date < todayIso;
                      const isToday = ev.date === todayIso;

                      return (
                        <div
                          key={ev.id}
                          className={`card cal-event-card ${isToday ? 'event-today' : ''} ${isPast ? 'event-past' : ''}`}
                        >
                          <div className="cal-card-left">
                            <div className="cal-date-block">
                              <span className="cal-date-month">{monthName.slice(0, 3).toUpperCase()}</span>
                              <span className="cal-date-day">{dayNum}</span>
                              <span className="cal-date-weekday">{weekday}</span>
                            </div>

                            <div className="cal-card-info">
                              <div className="cal-card-title-row">
                                <h4>{ev.title}</h4>
                                {isToday && <span className="cal-badge-today">Today!</span>}
                                {ev.is_long_weekend && (
                                  <span className="cal-pill-tag tag-long-weekend">
                                    🎉 3-Day Long Weekend
                                  </span>
                                )}
                              </div>

                              <div className="cal-card-badges">
                                {getCategoryBadge(ev.category)}
                                {getOfficeStatusBadge(ev.office_status)}
                              </div>

                              {ev.description && (
                                <p className="cal-card-desc">{ev.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="cal-card-actions">
                            <button
                              type="button"
                              className="cal-btn-outline cal-btn-sm"
                              onClick={() => exportToICal([ev], `${ev.title.replace(/\s+/g, '_')}.ics`)}
                              title="Download iCal event"
                            >
                              <Download size={13} /> Add to iCal
                            </button>
                            {isSuperAdmin && (
                              <button
                                type="button"
                                className="cal-btn-delete cal-btn-sm"
                                onClick={() => handleDeleteEvent(ev.id)}
                                title="Remove holiday (Super Admin)"
                              >
                                <X size={13} /> Remove
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}

      {/* Add Custom Event Modal for Admin / Manager */}
      {showAddModal && (
        <div className="cal-modal-overlay">
          <div className="cal-modal-content">
            <div className="cal-modal-header">
              <h3>Add Organization Event or Holiday</h3>
              <button
                type="button"
                className="cal-close-btn"
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="cal-modal-form">
              <label>
                Event Title *
                <input
                  type="text"
                  required
                  placeholder="e.g. Tobatax Annual Hackathon, Regional Holiday"
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                />
              </label>

              <div className="cal-form-row">
                <label>
                  Date *
                  <input
                    type="date"
                    required
                    value={newEvent.date}
                    onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                  />
                </label>

                <label>
                  Category *
                  <select
                    value={newEvent.category}
                    onChange={e => setNewEvent({
                      ...newEvent,
                      category: e.target.value as CalendarEvent['category']
                    })}
                  >
                    <option value="ANNUAL_DAY">🏢 Annual Company Day</option>
                    <option value="PUBLIC_HOLIDAY">🏛️ Public Holiday</option>
                    <option value="FESTIVAL">✨ Cultural Festival</option>
                    <option value="RESTRICTED_HOLIDAY">📌 Optional / Restricted</option>
                  </select>
                </label>
              </div>

              <div className="cal-form-row">
                <label>
                  Office Attendance Status *
                  <select
                    value={newEvent.office_status}
                    onChange={e => setNewEvent({
                      ...newEvent,
                      office_status: e.target.value as CalendarEvent['office_status']
                    })}
                  >
                    <option value="WORKING_CELEBRATION">Company Celebration (Working)</option>
                    <option value="CLOSED">Office Closed (Paid Holiday)</option>
                    <option value="OPTIONAL">Optional / Restricted Leave</option>
                    <option value="HALF_DAY">Half-Day Celebration</option>
                  </select>
                </label>

                <label className="cal-checkbox-label">
                  <input
                    type="checkbox"
                    checked={newEvent.is_long_weekend}
                    onChange={e => setNewEvent({ ...newEvent, is_long_weekend: e.target.checked })}
                  />
                  <span>Forms a Long Weekend (3-4 days)</span>
                </label>
              </div>

              <label>
                Description / Celebration Notes
                <textarea
                  rows={3}
                  placeholder="Details about townhall, dress code, traditions, or office arrangements..."
                  value={newEvent.description}
                  onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                />
              </label>

              <div className="cal-modal-buttons">
                <button
                  type="button"
                  className="cal-btn-outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cal-btn-primary"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
