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

const SettingsIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.38.55.7 1 .9.2.08.42.1.6.1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
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
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [wifiIdentity, setWifiIdentity] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
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

  const connectToNetwork = useCallback(async (network, password = '', identity = '') => {
    if (!network?.ssid || wifiBusy) return;
    setWifiBusy(true);
    setWifiMessage(`Connecting to ${network.ssid}...`);
    try {
      if (network.saved) {
        await invoke('connect_wifi', { ssid: network.ssid });
      } else if (network.requiresIdentity || network.enterprise) {
        await invoke('connect_enterprise_wifi', {
          ssid: network.ssid,
          username: identity,
          password,
        });
      } else if (network.secure) {
        await invoke('connect_wifi_with_password', {
          ssid: network.ssid,
          password,
          auth: network.auth || '',
          encryption: network.encryption || '',
        });
      } else {
        await invoke('connect_wifi_with_password', {
          ssid: network.ssid,
          password: '',
          auth: network.auth || 'Open',
          encryption: network.encryption || 'None',
        });
      }
      setWifiMessage(`Connected to ${network.ssid}`);
      setSelectedNetwork(null);
      setWifiIdentity('');
      setWifiPassword('');
      if (wifiReconnectTimer.current) clearTimeout(wifiReconnectTimer.current);
      wifiReconnectTimer.current = setTimeout(() => refreshWifi(), 1200);
    } catch (e) {
      console.error('Failed to connect WiFi:', e);
      setWifiMessage(network.enterprise ? 'Could not join. Check identity, password, or certificate rules.' : network.secure ? 'Could not join. Check the password or network security type.' : 'Could not join this network.');
    } finally {
      setWifiBusy(false);
    }
  }, [refreshWifi, wifiBusy]);

  const forgetWifi = useCallback(async (network) => {
    if (!network?.ssid || wifiBusy) return;
    setWifiBusy(true);
    setWifiMessage(`Forgetting ${network.ssid}...`);
    try {
      if (network.connected) {
        await invoke('disconnect_wifi');
        setWifiStatus({ connected: false, ssid: '', signal: 0 });
      }
      await invoke('forget_wifi', { ssid: network.ssid });
      setWifiMessage(`Forgot ${network.ssid}`);
      setSelectedNetwork(null);
      setWifiIdentity('');
      setWifiPassword('');
      await refreshWifi();
    } catch (e) {
      console.error('Failed to forget WiFi:', e);
      setWifiMessage('Could not forget this network.');
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

  const visibleNetworks = networks.filter((net) => net.visible || net.connected);
  const savedOutOfRangeNetworks = networks.filter((net) => net.saved && !net.visible && !net.connected);

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
                  <button className="wifi-icon-btn" onClick={openWifiSettings} title="Open Windows WiFi settings">
                    <SettingsIcon />
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
                {visibleNetworks.length === 0 && <div className="popover-empty">No available networks found</div>}
                {visibleNetworks.map((net, idx) => (
                  <div
                    key={`${net.ssid}-${idx}`}
                    className={`network-card${net.connected ? ' connected' : ''}${selectedNetwork?.ssid === net.ssid ? ' selected' : ''}`}
                  >
                    <button
                      className="network"
                      onClick={() => {
                        if (net.connected) {
                          setSelectedNetwork((prev) => (prev?.ssid === net.ssid ? null : net));
                          return;
                        }
                        if (net.saved || !net.secure) {
                          connectToNetwork(net);
                          return;
                        }
                        setSelectedNetwork((prev) => (prev?.ssid === net.ssid ? null : net));
                        setWifiIdentity('');
                        setWifiPassword('');
                        setWifiMessage('');
                      }}
                      disabled={wifiBusy}
                    >
                      <WifiIcon />
                      <span className="network-copy">
                        <span className="network-name">{net.ssid}</span>
                        <span className="network-status">
                          {net.connected
                            ? 'Connected'
                            : net.saved
                              ? 'Saved profile'
                              : net.requiresIdentity || net.enterprise
                                ? 'Identity and password required'
                                : net.secure
                                ? `${net.auth || 'Secured'} network`
                                : 'Open network'}
                        </span>
                      </span>
                      <span className="network-signal">{net.visible ? `${Math.round((net.signal || 0) / 20)}/5` : 'saved'}</span>
                      <span className={`wifi-action-pill ${net.connected ? 'danger' : ''}`}>
                        {net.connected ? 'Manage' : net.saved || !net.secure ? 'Connect' : 'Join'}
                      </span>
                    </button>
                    {selectedNetwork?.ssid === net.ssid && (
                      <form
                        className={`wifi-join-form ${net.connected || net.saved ? 'profile-actions' : ''}`}
                        onSubmit={(event) => {
                          event.preventDefault();
                          connectToNetwork(net, wifiPassword, wifiIdentity);
                        }}
                      >
                        {!net.connected && !net.saved && (
                          <>
                            {(net.requiresIdentity || net.enterprise) && (
                              <input
                                type="text"
                                value={wifiIdentity}
                                autoFocus
                                placeholder="Username or identity"
                                onChange={(event) => setWifiIdentity(event.target.value)}
                              />
                            )}
                            {net.secure && (
                              <input
                                type="password"
                                value={wifiPassword}
                                autoFocus={!(net.requiresIdentity || net.enterprise)}
                                minLength={net.requiresIdentity || net.enterprise ? 1 : 8}
                                placeholder="Network password"
                                onChange={(event) => setWifiPassword(event.target.value)}
                              />
                            )}
                          </>
                        )}
                        <div className="wifi-join-actions">
                          <button type="button" onClick={() => { setSelectedNetwork(null); setWifiIdentity(''); setWifiPassword(''); }} disabled={wifiBusy}>
                            Cancel
                          </button>
                          {net.connected && (
                            <button type="button" className="danger" onClick={() => disconnectWifi()} disabled={wifiBusy}>
                              Disconnect
                            </button>
                          )}
                          {net.saved && (
                            <button type="button" className="danger" onClick={() => forgetWifi(net)} disabled={wifiBusy}>
                              Forget
                            </button>
                          )}
                          {!net.connected && (
                            <button type="submit" disabled={wifiBusy || (!net.saved && (net.requiresIdentity || net.enterprise) && (!wifiIdentity.trim() || !wifiPassword.trim())) || (!net.saved && !(net.requiresIdentity || net.enterprise) && net.secure && wifiPassword.length < 8)}>
                              {wifiBusy ? 'Joining...' : 'Connect'}
                            </button>
                          )}
                        </div>
                      </form>
                    )}
                  </div>
                ))}
                {savedOutOfRangeNetworks.length > 0 && (
                  <details className="saved-networks-group">
                    <summary>Saved out of range ({savedOutOfRangeNetworks.length})</summary>
                    {savedOutOfRangeNetworks.map((net, idx) => (
                      <div
                        key={`saved-${net.ssid}-${idx}`}
                        className={`network-card saved-only${selectedNetwork?.ssid === net.ssid ? ' selected' : ''}`}
                      >
                        <button
                          className="network"
                          onClick={() => {
                            setSelectedNetwork((prev) => (prev?.ssid === net.ssid ? null : net));
                            setWifiIdentity('');
                            setWifiPassword('');
                            setWifiMessage('');
                          }}
                          disabled={wifiBusy}
                        >
                          <WifiIcon />
                          <span className="network-copy">
                            <span className="network-name">{net.ssid}</span>
                            <span className="network-status">Saved profile, currently out of range</span>
                          </span>
                          <span className="network-signal">saved</span>
                          <span className="wifi-action-pill muted">Manage</span>
                        </button>
                        {selectedNetwork?.ssid === net.ssid && (
                          <form className="wifi-join-form profile-actions">
                            <div className="wifi-join-actions">
                              <button type="button" onClick={() => { setSelectedNetwork(null); setWifiIdentity(''); setWifiPassword(''); }} disabled={wifiBusy}>
                                Cancel
                              </button>
                              <button type="button" className="danger" onClick={() => forgetWifi(net)} disabled={wifiBusy}>
                                Forget
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ))}
                  </details>
                )}
              </div>
              <div className="wifi-footer">Available networks are shown first. Saved out-of-range profiles are tucked away below.</div>
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
