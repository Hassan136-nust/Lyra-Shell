import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../contexts/AppContext';
import logo from '../../public/logo.png';

/* ── Inline SVG Icons ─────────────────────────────────────────── */
const ArchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L1 22h6l5-10 5 10h6L12 2zm0 5.5L15.5 16h-7L12 7.5z"/>
  </svg>
);

const WifiIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.55a11 11 0 0 1 14 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>
  </svg>
);

const VolumeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
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

/* ── TopBar Component ─────────────────────────────────────────── */
const TopBar = () => {
  const { activeWindow, systemInfo, activeWorkspace, setActiveWorkspace, runAction } = useAppContext();
  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isCharging, setIsCharging] = useState(false);
  const [showPowerMenu, setShowPowerMenu] = useState(false);
  const [showWifi, setShowWifi] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [volume, setVolume] = useState(0);
  const [mute, setMute] = useState(false);
  const [isSlidingVolume, setIsSlidingVolume] = useState(false);
  const [networks, setNetworks] = useState([]);
  const [wifiStatus, setWifiStatus] = useState({ connected: false, ssid: '', signal: 0 });
  const powerMenuRef = useRef(null);
  const wifiRef = useRef(null);
  const volumeRef = useRef(null);

  const refreshWifi = useCallback(async () => {
    try {
      const [status, list] = await Promise.all([
        invoke('wifi_status'),
        invoke('list_wifi_networks'),
      ]);
      setWifiStatus(status);
      setNetworks(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to refresh WiFi data:', e);
    }
  }, []);

  const refreshAudio = useCallback(async () => {
    try {
      const [currentVolume, muted] = await Promise.all([
        invoke('get_volume'),
        invoke('get_mute'),
      ]);
      if (!isSlidingVolume) {
        setVolume(Number(currentVolume ?? 0));
      }
      setMute(Boolean(muted));
    } catch (e) {
      console.error('Failed to refresh audio data:', e);
    }
  }, [isSlidingVolume]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Battery
  useEffect(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then((b) => {
        const update = () => {
          setBatteryLevel(Math.round(b.level * 100));
          setIsCharging(b.charging);
        };
        update();
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
      });
    }
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const handler = (e) => {
      if (powerMenuRef.current && !powerMenuRef.current.contains(e.target)) setShowPowerMenu(false);
      if (wifiRef.current && !wifiRef.current.contains(e.target)) setShowWifi(false);
      if (volumeRef.current && !volumeRef.current.contains(e.target)) setShowVolume(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!showWifi) return;
    refreshWifi();
    const id = setInterval(refreshWifi, 6000);
    return () => clearInterval(id);
  }, [showWifi, refreshWifi]);

  useEffect(() => {
    if (!showVolume) return;
    refreshAudio();
    const id = setInterval(refreshAudio, 1000);
    return () => clearInterval(id);
  }, [showVolume, refreshAudio]);

  const formatDate = (d) => d.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' });
  const formatTime = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

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

        {/* Network */}
        <div className="tray-item tray-interactive" tabIndex={0} style={{ position: 'relative' }} ref={wifiRef}>
          <button className="tray-btn" style={{background:'none',border:'none',padding:0}} onClick={() => { setShowWifi((v) => !v); setShowVolume(false); }}>
            <WifiIcon />
            <span>WiFi</span>
          </button>
          <AnimatePresence>
            {showWifi && (
              <motion.div
                className="popover popover-wifi"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                style={{ position: 'absolute', top: 34, right: 0, width: 380, zIndex: 300 }}
              >
                <div className="popover-header popover-header-wifi">
                  <WifiIcon />
                  <span>WiFi Networks</span>
                  <span className="popover-powered">powered by <span>Arch</span></span>
                </div>
                {wifiStatus?.connected && (
                  <div className="wifi-current">
                    <span className="wifi-current-label">Connected</span>
                    <span className="wifi-current-name">{wifiStatus.ssid || 'Unknown network'}</span>
                  </div>
                )}
                <div className="wifi-list">
                  {networks.length === 0 && <div className="popover-empty">No networks found</div>}
                  {networks.map((net, idx) => (
                    <div
                      key={`${net.ssid}-${idx}`}
                      className={`network${net.connected ? ' connected' : ''}`}
                      style={{display:'flex',alignItems:'center',gap:10}}
                      onClick={async () => {
                        try {
                          await invoke('connect_wifi', { ssid: net.ssid });
                          setTimeout(() => refreshWifi(), 1200);
                        } catch (e) {
                          console.error('Failed to connect WiFi:', e);
                        }
                      }}
                    >
                      <WifiIcon />
                      <span className="network-name" style={{ fontWeight: net.connected ? 700 : 500, color: net.connected ? 'var(--ctp-blue)' : 'var(--ctp-text)' }}>{net.ssid}</span>
                      <span className="network-signal">{Math.round((net.signal || 0) / 20)}/5</span>
                      {net.connected && <span style={{ fontSize: 11, color: 'var(--ctp-green)', fontWeight: 600 }}>Connected</span>}
                    </div>
                  ))}
                </div>
                <div className="popover-footer">Manage Networks</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="tray-sep" />


        {/* Volume */}
        <div className="tray-item tray-interactive" tabIndex={0} style={{ position: 'relative' }} ref={volumeRef}>
          <button className="tray-btn" style={{background:'none',border:'none',padding:0}} onClick={() => { setShowVolume((v) => !v); setShowWifi(false); }}>
            <VolumeIcon />
            <span>{mute ? 'Muted' : `${volume}%`}</span>
          </button>
          <AnimatePresence>
            {showVolume && (
              <motion.div
                className="popover popover-volume"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                style={{ position: 'absolute', top: 34, right: 0, width: 350, zIndex: 300 }}
              >
                <div className="popover-header popover-header-volume">
                  <VolumeIcon />
                  <span>Volume blend</span>
                  <span className="popover-powered">mac + arch</span>
                </div>
                <div className="volume-popover-body">
                  <input
                    className="volume-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onMouseDown={() => setIsSlidingVolume(true)}
                    onMouseUp={() => setIsSlidingVolume(false)}
                    onTouchStart={() => setIsSlidingVolume(true)}
                    onTouchEnd={() => setIsSlidingVolume(false)}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setVolume(v);
                      invoke('set_volume', { value: v });
                    }}
                  />
                  <div className="volume-actions">
                    <button
                      className="volume-mute-btn"
                      onClick={async () => {
                        const next = !mute;
                        await invoke('set_mute', { value: next });
                        setMute(next);
                        refreshAudio();
                      }}
                    >
                      {mute ? 'Unmute' : 'Mute'}
                    </button>
                    <span className="volume-value">{mute ? 'Muted' : `${volume}%`}</span>
                  </div>
                  <div className="volume-output">Output: <span>Speakers</span></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
        <div className="tray-item tray-clock">
          <span>{formatDate(time)}</span>
          <span className="clock-time">{formatTime(time)}</span>
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
