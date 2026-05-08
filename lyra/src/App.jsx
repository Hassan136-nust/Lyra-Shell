import { useState } from 'react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import TopBar from './components/TopBar';
import './App.css';

function App() {
  const [actionStatus, setActionStatus] = useState('Shell ready');
  const [busyAction, setBusyAction] = useState('');

  const runAction = async (action, needsConfirm = false) => {
    if (needsConfirm) {
      const accepted = window.confirm(
        `Are you sure you want to ${action.replace('_', ' ')} the system right now?`,
      );
      if (!accepted) {
        return;
      }
    }

    try {
      setBusyAction(action);
      setActionStatus(`Running ${action.replace('_', ' ')}...`);
      const result = await invoke('run_system_action', { action });
      setActionStatus(result);
    } catch (error) {
      setActionStatus(String(error));
    } finally {
      setBusyAction('');
    }
  };

  const exitShell = async () => {
    await getCurrentWindow().close();
  };

  return (
    <div className="lyra-desktop-shell relative w-screen h-screen overflow-hidden">
      <div className="lyra-wallpaper absolute inset-0" />
      <div className="lyra-overlay absolute inset-0" />

      <TopBar />

      <div className="relative h-full pt-12 pb-20">
        <div className="absolute inset-0 lyra-grid-pattern" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="h-full px-8 py-8"
        >
          <div className="h-full w-full max-w-[1500px] mx-auto flex items-end justify-between no-select">
            <div className="space-y-4">
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.35 }}
                className="lyra-widget-panel p-4 w-72"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-white/80">Workspace</p>
                <h2 className="text-2xl text-white font-semibold mt-2">Lyra Desktop</h2>
                <p className="text-sm text-white/75 mt-1">
                  Windows-native backend with a clean Arch + mac inspired shell.
                </p>
              </motion.div>

              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.45 }}
                className="lyra-widget-panel p-4 w-72"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-white/80">Status</p>
                <div className="mt-3 space-y-2 text-sm text-white/80">
                  <div className="flex items-center justify-between">
                    <span>Shell Smoothness</span>
                    <span className="font-medium text-white">High</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Theme Integration</span>
                    <span className="font-medium text-white">Active</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.55 }}
                className="lyra-widget-panel p-4 w-80"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-white/80">Control Center</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    disabled={!!busyAction}
                    onClick={() => runAction('open_explorer')}
                    className="lyra-control-btn"
                  >
                    Files
                  </button>
                  <button
                    disabled={!!busyAction}
                    onClick={() => runAction('open_terminal')}
                    className="lyra-control-btn"
                  >
                    Terminal
                  </button>
                  <button
                    disabled={!!busyAction}
                    onClick={() => runAction('open_settings')}
                    className="lyra-control-btn"
                  >
                    Settings
                  </button>
                  <button
                    disabled={!!busyAction}
                    onClick={() => runAction('open_task_manager')}
                    className="lyra-control-btn"
                  >
                    Task Manager
                  </button>
                  <button
                    disabled={!!busyAction}
                    onClick={() => runAction('lock')}
                    className="lyra-control-btn"
                  >
                    Lock
                  </button>
                  <button onClick={exitShell} className="lyra-control-btn">
                    Exit Lyra
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    disabled={!!busyAction}
                    onClick={() => runAction('restart', true)}
                    className="lyra-control-btn lyra-danger-btn"
                  >
                    Restart
                  </button>
                  <button
                    disabled={!!busyAction}
                    onClick={() => runAction('shutdown', true)}
                    className="lyra-control-btn lyra-danger-btn"
                  >
                    Shutdown
                  </button>
                </div>
                <p className="text-xs text-white/80 mt-3">{actionStatus}</p>
              </motion.div>
            </div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="lyra-hero text-center"
            >
              <h1 className="text-7xl font-light mb-3 text-white drop-shadow-lg">Lyra</h1>
              <p className="text-base text-white/85 tracking-wide">
                Personal Operating Shell
              </p>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.6 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 lyra-dock px-4 py-2 flex items-center gap-2"
        >
          {['Home', 'Files', 'Terminal', 'Store', 'Settings'].map((item) => (
            <button key={item} className="lyra-dock-item">
              {item}
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export default App;
