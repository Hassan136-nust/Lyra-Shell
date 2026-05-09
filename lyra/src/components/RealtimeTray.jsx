import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';

const WifiIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.55a11 11 0 0 1 14 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <circle cx="12" cy="20" r="1" fill="currentColor" />
  </svg>
);

const VolumeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const RealtimeTray = () => {
  const [showWifi, setShowWifi] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [volume, setVolume] = useState(0);
  const [mute, setMute] = useState(false);
  const [isSlidingVolume, setIsSlidingVolume] = useState(false);
  const [networks, setNetworks] = useState([]);
  const [wifiStatus, setWifiStatus] = useState({ connected: false, ssid: '', signal: 0 });
  const [netSpeed, setNetSpeed] = useState({ downMbps: 0, upMbps: 0 });
  const wifiRef = useRef(null);
  const volumeRef = useRef(null);
  const netPrevRef = useRef(null);
  const netPrevTsRef = useRef(null);
  const wifiRequestInFlight = useRef(false);
  const audioRequestInFlight = useRef(false);
  const netRequestInFlight = useRef(false);

  const refreshWifi = useCallback(async () => {
    if (wifiRequestInFlight.current) return;
    wifiRequestInFlight.current = true;
    try {
      const [status, list] = await Promise.all([invoke('wifi_status'), invoke('list_wifi_networks')]);
      setWifiStatus(status);
      setNetworks(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to refresh WiFi data:', e);
    } finally {
      wifiRequestInFlight.current = false;
    }
  }, []);

  const refreshAudio = useCallback(async () => {
    if (audioRequestInFlight.current) return;
    audioRequestInFlight.current = true;
    try {
      const [currentVolume, muted] = await Promise.all([invoke('get_volume'), invoke('get_mute')]);
      if (!isSlidingVolume) setVolume(Number(currentVolume ?? 0));
      setMute(Boolean(muted));
    } catch (e) {
      console.error('Failed to refresh audio data:', e);
    } finally {
      audioRequestInFlight.current = false;
    }
  }, [isSlidingVolume]);

  useEffect(() => {
    const handler = (e) => {
      if (wifiRef.current && !wifiRef.current.contains(e.target)) setShowWifi(false);
      if (volumeRef.current && !volumeRef.current.contains(e.target)) setShowVolume(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    refreshAudio();
    const id = setInterval(refreshAudio, showVolume ? 1200 : 1800);
    return () => clearInterval(id);
  }, [showVolume, refreshAudio]);

  useEffect(() => {
    refreshWifi();
    const id = setInterval(refreshWifi, showWifi ? 6000 : 15000);
    return () => clearInterval(id);
  }, [showWifi, refreshWifi]);

  useEffect(() => {
    const pollNetwork = async () => {
      if (netRequestInFlight.current) return;
      netRequestInFlight.current = true;
      try {
        const counters = await invoke('get_network_counters');
        const now = Date.now();
        if (netPrevRef.current && netPrevTsRef.current) {
          const dt = Math.max((now - netPrevTsRef.current) / 1000, 0.001);
          const rxDelta = Math.max(0, Number(counters.rx_bytes || 0) - Number(netPrevRef.current.rx_bytes || 0));
          const txDelta = Math.max(0, Number(counters.tx_bytes || 0) - Number(netPrevRef.current.tx_bytes || 0));
          setNetSpeed({ downMbps: (rxDelta * 8) / dt / 1_000_000, upMbps: (txDelta * 8) / dt / 1_000_000 });
        }
        netPrevRef.current = counters;
        netPrevTsRef.current = now;
      } catch (e) {
        console.error('Failed to poll network speed:', e);
      } finally {
        netRequestInFlight.current = false;
      }
    };
    pollNetwork();
    const id = setInterval(pollNetwork, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className={`tray-item tray-interactive ${wifiStatus?.connected ? 'tray-online' : ''}`} tabIndex={0} style={{ position: 'relative' }} ref={wifiRef}>
        <button className="tray-btn" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => { setShowWifi((v) => !v); setShowVolume(false); }}>
          <WifiIcon />
          <span>WiFi</span>
        </button>
        <AnimatePresence>
          {showWifi && (
            <motion.div className="popover popover-wifi" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.18 }} style={{ position: 'absolute', top: 34, right: 0, width: 380, zIndex: 300 }}>
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
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
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

      <div className="tray-item tray-net-speed">
        <span>↓ {netSpeed.downMbps.toFixed(2)} Mbps</span>
        <span>↑ {netSpeed.upMbps.toFixed(2)} Mbps</span>
      </div>

      <div className="tray-sep" />

      <div className="tray-item tray-interactive" tabIndex={0} style={{ position: 'relative' }} ref={volumeRef}>
        <button className="tray-btn" style={{ background: 'none', border: 'none', padding: 0 }} onClick={() => { setShowVolume((v) => !v); setShowWifi(false); }}>
          <VolumeIcon />
          <span>{mute ? 'Muted' : `${volume}%`}</span>
        </button>
        <AnimatePresence>
          {showVolume && (
            <motion.div className="popover popover-volume" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.18 }} style={{ position: 'absolute', top: 34, right: 0, width: 350, zIndex: 300 }}>
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
                  onChange={(e) => {
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
    </>
  );
};

export default memo(RealtimeTray);
