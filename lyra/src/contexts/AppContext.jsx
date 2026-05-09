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

  const sameWindow = (a, b) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.hwnd === b.hwnd && a.pid === b.pid && a.title === b.title && a.process_name === b.process_name;
  };

  const sameSystemInfo = (a, b) =>
    a.cpu_usage === b.cpu_usage &&
    a.memory_used_gb === b.memory_used_gb &&
    a.memory_total_gb === b.memory_total_gb &&
    a.memory_percent === b.memory_percent;

  const sameRunningApps = (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (
        a[i].hwnd !== b[i].hwnd ||
        a[i].pid !== b[i].pid ||
        a[i].title !== b[i].title ||
        a[i].process_name !== b[i].process_name
      ) {
        return false;
      }
    }
    return true;
  };

  // Fetch running windows every 2s
  useEffect(() => {
    let mounted = true;
    let timerId = null;
    const poll = async () => {
      const result = await tauriInvoke('get_running_windows', {}, []);
      if (mounted && Array.isArray(result)) {
        setRunningApps((prev) => (sameRunningApps(prev, result) ? prev : result));
      }
      if (mounted) timerId = setTimeout(poll, 2500);
    };
    poll();
    return () => { mounted = false; clearTimeout(timerId); };
  }, []);

  // Fetch active window every 1s
  useEffect(() => {
    let mounted = true;
    let timerId = null;
    const poll = async () => {
      const result = await tauriInvoke('get_active_window', {}, null);
      if (mounted) {
        setActiveWindow((prev) => (sameWindow(prev, result) ? prev : result));
      }
      if (mounted) timerId = setTimeout(poll, 1500);
    };
    poll();
    return () => { mounted = false; clearTimeout(timerId); };
  }, []);

  // Fetch system info every 5s
  useEffect(() => {
    let mounted = true;
    let timerId = null;
    const poll = async () => {
      const result = await tauriInvoke('get_system_info', {}, null);
      if (mounted && result) {
        setSystemInfo((prev) => (sameSystemInfo(prev, result) ? prev : result));
      }
      if (mounted) timerId = setTimeout(poll, 5000);
    };
    poll();
    return () => { mounted = false; clearTimeout(timerId); };
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
