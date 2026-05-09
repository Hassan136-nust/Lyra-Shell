import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';

const TopBarSimple = () => {
  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isCharging, setIsCharging] = useState(false);
  const [showWifi, setShowWifi] = useState(false);
  const [networks, setNetworks] = useState([]);
  const [wifiStatus, setWifiStatus] = useState({ connected: false, ssid: '', signal: 0 });

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

  // Load WiFi data when menu opens
  useEffect(() => {
    if (showWifi) {
      invoke('list_wifi_networks')
        .then(setNetworks)
        .catch(err => console.error('WiFi error:', err));
      invoke('wifi_status')
        .then(setWifiStatus)
        .catch(err => console.error('WiFi status error:', err));
    }
  }, [showWifi]);

  const formatTime = (d) => {
    return d.toLocaleTimeString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <motion.div
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '32px',
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        color: 'white',
        fontSize: '13px'
      }}
    >
      {/* Left: App Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <span style={{ fontWeight: 'bold' }}>Lyra</span>
        <button style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer' }}>File</button>
        <button style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer' }}>Edit</button>
        <button style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer' }}>View</button>
        <button style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer' }}>Help</button>
      </div>

      {/* Right: System Tray */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
        {/* WiFi */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowWifi(!showWifi)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12.55a11 11 0 0 1 14 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <circle cx="12" cy="20" r="1" fill="currentColor"/>
            </svg>
            <span>WiFi</span>
          </button>

          {/* WiFi Menu */}
          {showWifi && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                position: 'absolute',
                top: '36px',
                right: 0,
                width: '300px',
                maxHeight: '400px',
                background: 'rgba(20, 20, 20, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                zIndex: 1000
              }}
            >
              {/* Header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                fontWeight: 'bold'
              }}>
                WiFi Networks
              </div>

              {/* Current Connection */}
              {wifiStatus.connected && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#3b82f6' }}>{wifiStatus.ssid}</div>
                  <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                    Connected • Signal: {wifiStatus.signal}%
                  </div>
                </div>
              )}

              {/* Networks List */}
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {networks.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6 }}>
                    No networks found
                  </div>
                )}
                {networks.map((net, idx) => (
                  <div
                    key={`${net.ssid}-${idx}`}
                    onClick={() => {
                      invoke('connect_wifi', { ssid: net.ssid })
                        .then(() => {
                          setShowWifi(false);
                          setTimeout(() => invoke('wifi_status').then(setWifiStatus), 2000);
                        })
                        .catch(err => alert('Failed to connect: ' + err));
                    }}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: idx < networks.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{net.ssid}</span>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>{net.signal}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Battery */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="20" height="12" viewBox="0 0 24 16" fill="none" stroke="white" strokeWidth="1.5">
            <rect x="1" y="2" width="18" height="12" rx="2"/>
            <rect x="2.5" y="3.5" width={`${(batteryLevel / 100) * 15}`} height="9" fill="white"/>
            <rect x="19" y="5" width="2" height="6" rx="1" fill="white"/>
          </svg>
          <span>{batteryLevel}%</span>
          {isCharging && <span style={{ color: '#fbbf24' }}>⚡</span>}
        </div>

        {/* Clock */}
        <div style={{ fontWeight: '500' }}>
          {formatTime(time)}
        </div>
      </div>
    </motion.div>
  );
};

export default TopBarSimple;
