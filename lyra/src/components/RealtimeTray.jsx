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

const RefreshIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 1-15.5 6.2" />
    <path d="M3 12A9 9 0 0 1 18.5 5.8" />
    <path d="M18 2v4h4" />
    <path d="M6 22v-4H2" />
  </svg>
);

const SlidersIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="2" y1="14" x2="6" y2="14" />
    <line x1="10" y1="8" x2="14" y2="8" />
    <line x1="18" y1="16" x2="22" y2="16" />
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
  const [wifiBusy, setWifiBusy] = useState(false);
  const [wifiMessage, setWifiMessage] = useState('');
  const [netSpeed, setNetSpeed] = useState({ downMbps: 0, upMbps: 0 });
  const wifiRef = useRef(null);
  const volumeRef = useRef(null);
  const netPrevRef = useRef(null);
  const netPrevTsRef = useRef(null);
  const wifiRequestInFlight = useRef(false);
  const audioRequestInFlight = useRef(false);
  const netRequestInFlight = useRef(false);
  const volumeWriteTimer = useRef(null);
  const wifiReconnectTimer = useRef(null);
  const volumeRefreshTimers = useRef([]);

  const refreshWifi = useCallback(async () => {
    if (wifiRequestInFlight.current) return;
    wifiRequestInFlight.current = true;
    try {
      const [status, list] = await Promise.all([invoke('wifi_status'), invoke('list_wifi_networks')]);
      setWifiStatus(status);
      setNetworks(Array.isArray(list) ? list : []);
      setWifiMessage('');
    } catch (e) {
      console.error('Failed to refresh WiFi data:', e);
      setWifiMessage('Could not refresh WiFi right now.');
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

  const queueAudioRefreshBurst = useCallback(() => {
    volumeRefreshTimers.current.forEach((timer) => clearTimeout(timer));
    volumeRefreshTimers.current = [80, 240, 520].map((delay) => setTimeout(refreshAudio, delay));
  }, [refreshAudio]);

  const connectToNetwork = useCallback(async (ssid) => {
    if (!ssid || wifiBusy) return;
    setWifiBusy(true);
    setWifiMessage(`Connecting to ${ssid}...`);
    try {
      await invoke('connect_wifi', { ssid });
      setWifiMessage(`Connected to ${ssid}`);
      if (wifiReconnectTimer.current) clearTimeout(wifiReconnectTimer.current);
      wifiReconnectTimer.current = setTimeout(() => refreshWifi(), 1200);
    } catch (e) {
      console.error('Failed to connect WiFi:', e);
      setWifiMessage('Saved profile required. Open settings to join new secured networks.');
    } finally {
      setWifiBusy(false);
    }
  }, [refreshWifi, wifiBusy]);

  const disconnectWifi = useCallback(async () => {
    if (wifiBusy) return;
    setWifiBusy(true);
    setWifiMessage('Disconnecting...');
    try {
      await invoke('disconnect_wifi');
      setWifiMessage('Disconnected');
      setWifiStatus({ connected: false, ssid: '', signal: 0 });
      if (wifiReconnectTimer.current) clearTimeout(wifiReconnectTimer.current);
      wifiReconnectTimer.current = setTimeout(() => refreshWifi(), 900);
    } catch (e) {
      console.error('Failed to disconnect WiFi:', e);
      setWifiMessage('Disconnect failed.');
    } finally {
      setWifiBusy(false);
    }
  }, [refreshWifi, wifiBusy]);

  const openWifiSettings = useCallback(() => {
    invoke('open_wifi_settings').catch((error) => {
      console.error('Failed to open WiFi settings:', error);
      setWifiMessage('Could not open Windows WiFi settings.');
    });
  }, []);

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
    const id = setInterval(refreshAudio, showVolume ? 650 : 1500);
    return () => clearInterval(id);
  }, [showVolume, refreshAudio]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (['AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute'].includes(event.key)) {
        queueAudioRefreshBurst();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('focus', queueAudioRefreshBurst);
    document.addEventListener('visibilitychange', queueAudioRefreshBurst);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('focus', queueAudioRefreshBurst);
      document.removeEventListener('visibilitychange', queueAudioRefreshBurst);
    };
  }, [queueAudioRefreshBurst]);

  useEffect(() => {
    if (showWifi) refreshWifi();
    const id = setInterval(refreshWifi, showWifi ? 10000 : 30000);
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
    const id = setInterval(pollNetwork, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => {
    if (volumeWriteTimer.current) clearTimeout(volumeWriteTimer.current);
    if (wifiReconnectTimer.current) clearTimeout(wifiReconnectTimer.current);
    volumeRefreshTimers.current.forEach((timer) => clearTimeout(timer));
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
            <motion.div className="popover popover-wifi wifi-manager" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.18 }} style={{ position: 'absolute', top: 34, right: 0, width: 420, zIndex: 300 }}>
              <div className="popover-header popover-header-wifi">
                <WifiIcon />
                <span>WiFi</span>
                <div className="wifi-header-actions">
                  <button className="wifi-icon-btn" onClick={refreshWifi} disabled={wifiBusy} title="Refresh networks">
                    <RefreshIcon />
                  </button>
                  <button className="wifi-icon-btn" onClick={openWifiSettings} title="Windows WiFi settings">
                    <SlidersIcon />
                  </button>
                </div>
              </div>
              <div className={`wifi-current ${wifiStatus?.connected ? 'online' : 'offline'}`}>
                <div className="wifi-orb"><WifiIcon /></div>
                <div className="wifi-current-main">
                  <span className="wifi-current-label">{wifiStatus?.connected ? 'Connected' : 'Offline'}</span>
                  <span className="wifi-current-name">{wifiStatus?.connected ? wifiStatus.ssid || 'Unknown network' : 'Not connected'}</span>
                </div>
                <div className="wifi-current-meta">
                  <span>{wifiStatus?.connected ? `${Math.round((wifiStatus.signal || 0) / 20)}/5` : '0/5'}</span>
                  {wifiStatus?.connected && (
                    <button className="wifi-action-btn danger" onClick={disconnectWifi} disabled={wifiBusy}>
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
              {wifiMessage && <div className="wifi-message">{wifiMessage}</div>}
              <div className="wifi-list">
                {networks.length === 0 && <div className="popover-empty">No networks found</div>}
                {networks.map((net, idx) => (
                  <button
                    key={`${net.ssid}-${idx}`}
                    className={`network${net.connected ? ' connected' : ''}`}
                    onClick={() => (net.connected ? disconnectWifi() : connectToNetwork(net.ssid))}
                    disabled={wifiBusy}
                  >
                    <WifiIcon />
                    <span className="network-copy">
                      <span className="network-name">{net.ssid}</span>
                      <span className="network-status">{net.connected ? 'Connected' : 'Saved networks connect instantly'}</span>
                    </span>
                    <span className="network-signal">{Math.round((net.signal || 0) / 20)}/5</span>
                    <span className={`wifi-action-pill ${net.connected ? 'danger' : ''}`}>
                      {net.connected ? 'Disconnect' : 'Connect'}
                    </span>
                  </button>
                ))}
              </div>
              <div className="wifi-footer">
                <span>New password-protected networks open in Windows settings.</span>
                <button onClick={openWifiSettings}>Manage</button>
              </div>
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
                <span>Volume</span>
                <span className="popover-powered">Lyra</span>
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
                    if (volumeWriteTimer.current) clearTimeout(volumeWriteTimer.current);
                    volumeWriteTimer.current = setTimeout(() => {
                      invoke('set_volume', { value: v }).catch((error) => {
                        console.error('Failed to set volume:', error);
                      });
                    }, 120);
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
