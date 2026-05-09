import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};

// Safely call Tauri invoke — returns fallback if not in Tauri env
async function tauriInvoke(cmd, args = {}, fallback = null) {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke(cmd, args);
  } catch {
    return fallback;
  }
}

export const AppProvider = ({ children }) => {
  const [runningApps, setRunningApps] = useState([]);
  const [activeWindow, setActiveWindow] = useState(null);
  const [systemInfo, setSystemInfo] = useState({
    cpu_usage: 0,
    memory_used_gb: 0,
    memory_total_gb: 0,
    memory_percent: 0,
  });
  const [activeWorkspace, setActiveWorkspace] = useState(1);

  // Fetch running windows every 2s
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const result = await tauriInvoke('get_running_windows', {}, []);
      if (mounted && result) setRunningApps(result);
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // Fetch active window every 1s
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const result = await tauriInvoke('get_active_window', {}, null);
      if (mounted) setActiveWindow(result);
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // Fetch system info every 5s
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const result = await tauriInvoke('get_system_info', {}, null);
      if (mounted && result) setSystemInfo(result);
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const focusWindow = useCallback(async (hwnd) => {
    await tauriInvoke('focus_window', { hwnd });
  }, []);

  const minimizeWindow = useCallback(async (hwnd) => {
    await tauriInvoke('minimize_window', { hwnd });
  }, []);

  const closeWindow = useCallback(async (hwnd) => {
    await tauriInvoke('close_window', { hwnd });
  }, []);

  const runAction = useCallback(async (action) => {
    await tauriInvoke('run_system_action', { action });
  }, []);

  const launchApp = useCallback(async (path) => {
    await tauriInvoke('launch_app', { path });
  }, []);

  return (
    <AppContext.Provider value={{
      runningApps,
      activeWindow,
      systemInfo,
      activeWorkspace,
      setActiveWorkspace,
      focusWindow,
      minimizeWindow,
      closeWindow,
      runAction,
      launchApp,
    }}>
      {children}
    </AppContext.Provider>
  );
};
