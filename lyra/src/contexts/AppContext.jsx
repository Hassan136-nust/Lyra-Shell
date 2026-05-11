import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

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
  } catch (error) {
    if (cmd !== 'log_frontend_error') {
      console.warn(`Tauri command failed: ${cmd}`, error);
    }
    return fallback;
  }
}

function useStablePoll(callback, intervalMs, hiddenIntervalMs = intervalMs * 3) {
  useEffect(() => {
    let disposed = false;
    let timerId = null;
    let inFlight = false;

    const schedule = () => {
      if (disposed) return;
      const delay = document.hidden ? hiddenIntervalMs : intervalMs;
      timerId = window.setTimeout(tick, delay);
    };

    const tick = async () => {
      if (disposed || inFlight) {
        schedule();
        return;
      }
      inFlight = true;
      try {
        await callback();
      } finally {
        inFlight = false;
        schedule();
      }
    };

    tick();
    return () => {
      disposed = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [callback, intervalMs, hiddenIntervalMs]);
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
  const [isLocked, setIsLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Check biometric availability once on startup (fast sc query, non-blocking)
  useEffect(() => {
    tauriInvoke('check_biometric_available', {}, false)
      .then((avail) => setBiometricAvailable(!!avail))
      .catch(() => { });
  }, []);

  // Block dangerous keyboard shortcuts when locked
  useEffect(() => {
    if (!isLocked) return;
    const handler = (e) => {
      if (e.altKey && e.key === 'F4') e.preventDefault();
      if (e.ctrlKey && (e.key === 'w' || e.key === 'W')) e.preventDefault();
      if (e.key === 'Escape') e.preventDefault();
      if (e.metaKey) e.preventDefault();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isLocked]);

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

  useStablePoll(useCallback(async () => {
    const result = await tauriInvoke('get_running_windows', {}, []);
    if (Array.isArray(result)) {
      setRunningApps((prev) => (sameRunningApps(prev, result) ? prev : result));
    }
  }, []), 4000, 12000);

  useStablePoll(useCallback(async () => {
    const result = await tauriInvoke('get_active_window', {}, null);
    setActiveWindow((prev) => (sameWindow(prev, result) ? prev : result));
  }, []), 2500, 8000);

  useStablePoll(useCallback(async () => {
    const result = await tauriInvoke('get_system_info', {}, null);
    if (result) {
      setSystemInfo((prev) => (sameSystemInfo(prev, result) ? prev : result));
    }
  }, []), 8000, 20000);

  const focusWindow = useCallback(async (hwnd) => {
    await tauriInvoke('focus_window', { hwnd });
  }, []);

  const minimizeWindow = useCallback(async (hwnd) => {
    await tauriInvoke('minimize_window', { hwnd });
  }, []);

  const closeWindow = useCallback(async (hwnd) => {
    await tauriInvoke('close_window', { hwnd });
  }, []);

  const lockScreen = useCallback(() => {
    setIsLocked(true);
    tauriInvoke('set_lock_state', { locked: true });
  }, []);

  const unlockScreen = useCallback(() => {
    setIsLocked(false);
    tauriInvoke('set_lock_state', { locked: false });
  }, []);

  const runAction = useCallback(async (action) => {
    if (action === 'lock') {
      lockScreen();
      return;
    }
    await tauriInvoke('run_system_action', { action });
  }, [lockScreen]);

  useEffect(() => {
    let unlistenFn = null;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('trigger-lyra-lock', () => {
        lockScreen();
      }).then(unlisten => {
        unlistenFn = unlisten;
      });
    }).catch(console.error);

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [lockScreen]);

  const launchApp = useCallback(async (path) => {
    await tauriInvoke('launch_app', { path });
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
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
    isLocked,
    lockScreen,
    unlockScreen,
    biometricAvailable,
  }), [
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
    isLocked,
    lockScreen,
    unlockScreen,
    biometricAvailable,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};
