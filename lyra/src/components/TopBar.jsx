import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../contexts/AppContext';
import RealtimeTray from './RealtimeTray';
import logo from '../../public/logo.png';

/* ── Inline SVG Icons ─────────────────────────────────────────── */
const ArchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L1 22h6l5-10 5 10h6L12 2zm0 5.5L15.5 16h-7L12 7.5z"/>
  </svg>
);

const BatteryIcon = ({ level, charging }) => (
  <svg width="18" height="11" viewBox="0 0 28 16" fill="none">
    <rect x="1" y="1" width="22" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="3" y="3" width={Math.max(1, (level / 100) * 18)} height="10" rx="1"
      fill={level > 20 ? 'var(--ctp-green)' : 'var(--ctp-red)'}/>
    <rect x="23" y="5" width="3" height="6" rx="1" fill="currentColor"/>
    {charging && <text x="10" y="12" fontSize="9" fill="var(--ctp-yellow)" textAnchor="middle">⚡</text>}
  </svg>
);

const CpuIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
    <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
    <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
  </svg>
);

const MemoryIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <line x1="6" y1="6" x2="6" y2="2"/><line x1="10" y1="6" x2="10" y2="2"/>
    <line x1="14" y1="6" x2="14" y2="2"/><line x1="18" y1="6" x2="18" y2="2"/>
  </svg>
);

const PowerIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
  </svg>
);

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const RestartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const ShutdownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
  </svg>
);

const SleepIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const LogoutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

/* ── Mini Progress Bar ────────────────────────────────────────── */
const MiniBar = ({ value, color = 'var(--ctp-blue)', width = 40 }) => (
  <div style={{
    width: `${width}px`, height: '4px', background: 'var(--ctp-surface0)',
    borderRadius: '2px', overflow: 'hidden', flexShrink: 0,
  }}>
    <motion.div
      style={{ height: '100%', borderRadius: '2px', background: color }}
      animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      transition={{ duration: 0.5 }}
    />
  </div>
);

const toDateTimeLocalValue = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const buildCalendarDays = (viewDate) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

/* ── TopBar Component ─────────────────────────────────────────── */
const TopBar = () => {
  const { activeWindow, systemInfo, activeWorkspace, setActiveWorkspace, runAction } = useAppContext();
  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isCharging, setIsCharging] = useState(false);
  const [showPowerMenu, setShowPowerMenu] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarView, setCalendarView] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
  const [dateTimeDraft, setDateTimeDraft] = useState(toDateTimeLocalValue(new Date()));
  const [dateTimeEditing, setDateTimeEditing] = useState(false);
  const [dateTimeMessage, setDateTimeMessage] = useState('');
  const powerMenuRef = useRef(null);
  const calendarRef = useRef(null);
  const clockPreviewRef = useRef(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const preview = clockPreviewRef.current;
      if (preview && Date.now() < preview.until) {
        setTime(new Date(preview.base.getTime() + Date.now() - preview.started));
        return;
      }
      clockPreviewRef.current = null;
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Battery
  useEffect(() => {
    let battery = null;
    let disposed = false;
    let update = null;

    if ('getBattery' in navigator) {
      navigator.getBattery().then((b) => {
        if (disposed) return;
        battery = b;
        update = () => {
          setBatteryLevel(Math.round(b.level * 100));
          setIsCharging(b.charging);
        };
        update();
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
      });
    }

    return () => {
      disposed = true;
      if (battery && update) {
        battery.removeEventListener('levelchange', update);
        battery.removeEventListener('chargingchange', update);
      }
    };
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e) => {
      if (powerMenuRef.current && !powerMenuRef.current.contains(e.target)) setShowPowerMenu(false);
      if (calendarRef.current && !calendarRef.current.contains(e.target)) setShowCalendar(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatDate = (d) => d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' });
  const formatTime = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const monthLabel = calendarView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  const calendarDays = buildCalendarDays(calendarView);
  const isSameDay = (a, b) => a.toDateString() === b.toDateString();

  const applyDateTime = async () => {
    const updated = new Date(dateTimeDraft);
    if (Number.isNaN(updated.getTime())) {
      setDateTimeMessage('Choose a valid date and time');
      return;
    }

    clockPreviewRef.current = {
      base: updated,
      started: Date.now(),
      until: Date.now() + 60_000,
    };
    setTime(updated);
    setCalendarView(updated);
    setSelectedCalendarDate(updated);
    setDateTimeDraft(toDateTimeLocalValue(updated));
    setDateTimeMessage('Applying...');
    try {
      await invoke('set_system_datetime', { value: dateTimeDraft });
      clockPreviewRef.current = null;
      setTime(new Date());
      setDateTimeMessage('Date and time updated');
    } catch (error) {
      setDateTimeMessage(String(error || 'Could not update date/time'));
    }
  };

  const openDateTimeSettings = async () => {
    try {
      await invoke('open_datetime_settings');
      setDateTimeMessage('');
    } catch (error) {
      setDateTimeMessage(String(error || 'Could not open settings'));
    }
  };

  const cpuColor = systemInfo.cpu_usage > 80 ? 'var(--ctp-red)' : systemInfo.cpu_usage > 50 ? 'var(--ctp-peach)' : 'var(--ctp-green)';
  const ramColor = systemInfo.memory_percent > 80 ? 'var(--ctp-red)' : systemInfo.memory_percent > 50 ? 'var(--ctp-peach)' : 'var(--ctp-blue)';

  const powerActions = [
    { label: 'Lock', icon: LockIcon, action: 'lock', color: 'var(--ctp-blue)' },
    { label: 'Sleep', icon: SleepIcon, action: 'sleep', color: 'var(--ctp-lavender)' },
    { label: 'Log Out', icon: LogoutIcon, action: 'logout', color: 'var(--ctp-yellow)' },
    { label: 'Restart', icon: RestartIcon, action: 'restart', color: 'var(--ctp-peach)' },
    { label: 'Shutdown', icon: ShutdownIcon, action: 'shutdown', color: 'var(--ctp-red)' },
  ];

  return (
    <motion.div
      initial={{ y: -36, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="topbar"
    >
      {/* ── Left: Logo + Workspaces + Active Window ── */}
      <div className="topbar-section topbar-left">
        {/* Project Logo */}
        <div className="topbar-logo">
          <img src={logo} alt="Lyra Logo" style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 4 }} />
        </div>

        {/* Workspace Pills */}
        <div className="topbar-workspaces">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((ws) => (
            <button
              key={ws}
              className={`ws-btn ${activeWorkspace === ws ? 'ws-active' : ''}`}
              onClick={() => setActiveWorkspace(ws)}
            >
              {ws}
            </button>
          ))}
        </div>

        {/* Active Window Title */}
        {activeWindow && (
          <div className="topbar-window-title">
            <span className="window-proc">{activeWindow.process_name?.replace('.exe', '')}</span>
            <span className="window-sep">›</span>
            <span className="window-name">{activeWindow.title?.length > 50 ? activeWindow.title.slice(0, 50) + '…' : activeWindow.title}</span>
          </div>
        )}
      </div>

      {/* ── Right: System Tray ── */}
      <div className="topbar-section topbar-right">

        <RealtimeTray />

        <div className="tray-sep" />

        {/* CPU */}
        <div className="tray-item">
          <CpuIcon />
          <MiniBar value={systemInfo.cpu_usage} color={cpuColor} />
          <span>{systemInfo.cpu_usage?.toFixed(0)}%</span>
        </div>

        {/* RAM */}
        <div className="tray-item">
          <MemoryIcon />
          <MiniBar value={systemInfo.memory_percent} color={ramColor} />
          <span>{systemInfo.memory_percent?.toFixed(0)}%</span>
        </div>

        <div className="tray-sep" />

        {/* Battery */}
        <div className="tray-item">
          <BatteryIcon level={batteryLevel} charging={isCharging} />
          <span>{batteryLevel}%</span>
        </div>

        <div className="tray-sep" />

        {/* Clock */}
        <div className="clock-wrap" ref={calendarRef}>
          <button
            className={`tray-item tray-clock tray-clock-btn ${showCalendar ? 'active' : ''}`}
            onClick={() => {
              setShowCalendar((v) => !v);
              setShowPowerMenu(false);
              setCalendarView(new Date());
              setSelectedCalendarDate(new Date());
              setDateTimeDraft(toDateTimeLocalValue(new Date()));
              setDateTimeEditing(false);
              setDateTimeMessage('');
            }}
          >
            <span>{formatDate(time)}</span>
            <span className="clock-time">{formatTime(time)}</span>
          </button>

          <AnimatePresence>
            {showCalendar && (
              <motion.div
                className="calendar-popover"
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
              >
                <div className="calendar-head">
                  <button onClick={() => setCalendarView(new Date(calendarView.getFullYear(), calendarView.getMonth() - 1, 1))}>‹</button>
                  <span>{monthLabel}</span>
                  <button onClick={() => setCalendarView(new Date(calendarView.getFullYear(), calendarView.getMonth() + 1, 1))}>›</button>
                </div>
                <div className="calendar-weekdays">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => <span key={`${day}-${idx}`}>{day}</span>)}
                </div>
                <div className="calendar-grid">
                  {calendarDays.map((day) => (
                    <button
                      key={day.toISOString()}
                      className={`${day.getMonth() === calendarView.getMonth() ? '' : 'muted'} ${isSameDay(day, today) ? 'today' : ''} ${isSameDay(day, selectedCalendarDate) ? 'selected' : ''}`}
                      onClick={() => {
                        const selected = new Date(day);
                        selected.setHours(time.getHours(), time.getMinutes(), 0, 0);
                        setSelectedCalendarDate(selected);
                        setCalendarView(selected);
                        setDateTimeDraft(toDateTimeLocalValue(selected));
                      }}
                    >
                      {day.getDate()}
                    </button>
                  ))}
                </div>
                <div className="datetime-editor">
                  <input
                    type="datetime-local"
                    value={dateTimeDraft}
                    disabled={!dateTimeEditing}
                    onChange={(e) => {
                      setDateTimeDraft(e.target.value);
                      const selected = new Date(e.target.value);
                      if (!Number.isNaN(selected.getTime())) {
                        setSelectedCalendarDate(selected);
                        setCalendarView(selected);
                      }
                    }}
                  />
                  {dateTimeMessage && <div className="datetime-message">{dateTimeMessage}</div>}
                  <div className="datetime-actions">
                    <button onClick={() => { const now = new Date(); setCalendarView(now); setSelectedCalendarDate(now); setDateTimeDraft(toDateTimeLocalValue(now)); setDateTimeMessage(''); }}>Today</button>
                    <button onClick={openDateTimeSettings}>Settings</button>
                    {dateTimeEditing ? (
                      <button className="primary" onClick={applyDateTime}>Apply</button>
                    ) : (
                      <button className="primary" onClick={() => { setDateTimeEditing(true); setDateTimeMessage(''); }}>Change</button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="tray-sep" />

        {/* Power Button */}
        <div className="power-wrap" ref={powerMenuRef}>
          <button
            className={`tray-btn power-btn ${showPowerMenu ? 'active' : ''}`}
            onClick={() => setShowPowerMenu(!showPowerMenu)}
          >
            <PowerIcon />
          </button>

          <AnimatePresence>
            {showPowerMenu && (
              <motion.div
                className="power-menu"
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                {powerActions.map((pa) => (
                  <button
                    key={pa.action}
                    className="power-menu-item"
                    onClick={() => { runAction(pa.action); setShowPowerMenu(false); }}
                  >
                    <span style={{ color: pa.color }}><pa.icon /></span>
                    <span>{pa.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default TopBar;
