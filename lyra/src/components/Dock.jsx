import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../contexts/AppContext';

/* ── SVG Icon Generator ───────────────────────────────────────── */
const createSvgIcon = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/* ── App icon mapping by process name ─────────────────────────── */
const processIconMap = {
  'explorer.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#0078d4"/>
      <path d="M16 20h32v24H16z" fill="#fff" opacity="0.9"/>
      <rect x="20" y="24" width="10" height="12" fill="#0078d4" opacity="0.7"/>
      <rect x="34" y="24" width="10" height="12" fill="#0078d4" opacity="0.5"/>
    </svg>`),
  },
  'WindowsTerminal.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#000"/>
      <rect x="8" y="8" width="48" height="48" rx="4" fill="#012456"/>
      <text x="16" y="40" font-size="20" fill="#00ff00" font-family="monospace">▶</text>
    </svg>`),
  },
  'cmd.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#0c0c0c"/>
      <rect x="6" y="6" width="52" height="52" rx="3" fill="#1e1e1e"/>
      <text x="14" y="42" font-size="18" fill="#89b4fa" font-family="monospace" font-weight="bold">&gt;_</text>
    </svg>`),
  },
  'powershell.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#0078d7"/>
      <path d="M20 24L44 32L20 40Z" fill="#fff" opacity="0.9"/>
      <circle cx="32" cy="48" r="3" fill="#fff" opacity="0.8"/>
    </svg>`),
  },
  'chrome.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="28" fill="#ea4335"/>
      <circle cx="32" cy="32" r="22" fill="#fbbc04"/>
      <circle cx="32" cy="32" r="16" fill="#4285f4"/>
      <circle cx="32" cy="32" r="8" fill="#34a853"/>
    </svg>`),
  },
  'msedge.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="28" fill="#0078d4"/>
      <path d="M32 10 Q45 18 45 32 Q45 46 32 54 Q32 40 32 32 Q32 24 32 10Z" fill="#00a4ef"/>
    </svg>`),
  },
  'firefox.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="26" fill="#ff9500"/>
      <circle cx="32" cy="32" r="20" fill="#ffb100"/>
      <path d="M32 14 Q42 20 42 32 Q42 44 32 50" fill="#ff6600"/>
    </svg>`),
  },
  'brave.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#fb542b"/>
      <path d="M24 32 L28 24 L32 20 L36 24 L40 32 L36 40 L32 44 L28 40Z" fill="#fff"/>
    </svg>`),
  },
  'Code.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#0078d4"/>
      <path d="M20 28 L28 36 L20 44" stroke="#fff" stroke-width="3" fill="none"/>
      <path d="M44 28 L36 36 L44 44" stroke="#fff" stroke-width="3" fill="none"/>
    </svg>`),
  },
  'Spotify.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="28" fill="#1db954"/>
      <circle cx="26" cy="28" r="2" fill="#000"/>
      <circle cx="32" cy="32" r="2" fill="#000"/>
      <circle cx="38" cy="28" r="2" fill="#000"/>
    </svg>`),
  },
  'Discord.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#5865f2"/>
      <circle cx="24" cy="32" r="4" fill="#fff"/>
      <circle cx="32" cy="32" r="4" fill="#fff"/>
      <circle cx="40" cy="32" r="4" fill="#fff"/>
    </svg>`),
  },
  'Telegram.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#2aabee"/>
      <path d="M24 36 L38 26 L24 32Z" fill="#fff"/>
      <path d="M32 40 L42 26 L32 32Z" fill="#fff" opacity="0.8"/>
    </svg>`),
  },
  'slack.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#e01e5a"/>
      <g fill="#fff" opacity="0.3">
        <rect x="22" y="18" width="6" height="28"/>
        <rect x="36" y="18" width="6" height="28"/>
      </g>
    </svg>`),
  },
  'notepad.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="10" width="40" height="44" rx="2" fill="#fce4b8" stroke="#999" stroke-width="1"/>
      <line x1="14" y1="16" x2="50" y2="16" stroke="#999" stroke-width="0.5"/>
      <line x1="14" y1="22" x2="50" y2="22" stroke="#999" stroke-width="0.5"/>
      <line x1="14" y1="28" x2="50" y2="28" stroke="#999" stroke-width="0.5"/>
    </svg>`),
  },
  'Notepad.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="10" width="40" height="44" rx="2" fill="#fce4b8" stroke="#999" stroke-width="1"/>
      <line x1="14" y1="16" x2="50" y2="16" stroke="#999" stroke-width="0.5"/>
      <line x1="14" y1="22" x2="50" y2="22" stroke="#999" stroke-width="0.5"/>
      <line x1="14" y1="28" x2="50" y2="28" stroke="#999" stroke-width="0.5"/>
    </svg>`),
  },
  'taskmgr.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#0078d4"/>
      <rect x="14" y="16" width="10" height="24" fill="#fff" opacity="0.8"/>
      <rect x="28" y="20" width="10" height="20" fill="#fff" opacity="0.6"/>
      <rect x="42" y="24" width="10" height="16" fill="#fff" opacity="0.4"/>
    </svg>`),
  },
  'SystemSettings.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="8" fill="#0078d4" stroke="#fff" stroke-width="2"/>
      <circle cx="32" cy="14" r="3" fill="#0078d4" stroke="#fff" stroke-width="1.5"/>
      <circle cx="46" cy="22" r="3" fill="#0078d4" stroke="#fff" stroke-width="1.5"/>
      <circle cx="50" cy="32" r="3" fill="#0078d4" stroke="#fff" stroke-width="1.5"/>
    </svg>`),
  },
  'WINWORD.EXE': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#185abd"/>
      <text x="32" y="40" font-size="28" fill="#fff" font-weight="bold" text-anchor="middle">W</text>
    </svg>`),
  },
  'EXCEL.EXE': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#107c41"/>
      <text x="32" y="40" font-size="28" fill="#fff" font-weight="bold" text-anchor="middle">X</text>
    </svg>`),
  },
  'POWERPNT.EXE': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#c43e1c"/>
      <text x="32" y="40" font-size="28" fill="#fff" font-weight="bold" text-anchor="middle">P</text>
    </svg>`),
  },
  'vlc.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="#ff8800"/>
      <path d="M24 24 L40 32 L24 40Z" fill="#fff"/>
    </svg>`),
  },
};


function getAppVisual(processName) {
  const icon = processIconMap[processName];
  if (icon) return icon;
  
  // Fallback: create a simple colored badge with first letter
  const letter = processName?.charAt(0)?.toUpperCase() || '?';
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  const color = colors[processName?.charCodeAt(0) % colors.length];
  
  return {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="8" fill="${color}"/>
      <text x="32" y="40" font-size="32" fill="#fff" font-weight="bold" text-anchor="middle" font-family="Arial">${letter}</text>
    </svg>`),
  };
}

/* ── Pinned apps config ───────────────────────────────────────── */
const pinnedApps = [
  { name: 'Files', action: 'open_explorer', ...processIconMap['explorer.exe'] },
  { name: 'Terminal', action: 'open_terminal', ...processIconMap['WindowsTerminal.exe'] },
  { name: 'Browser', action: 'open_browser', ...processIconMap['msedge.exe'] },
  { name: 'Settings', action: 'open_settings', ...processIconMap['SystemSettings.exe'] },
];

/* ── Single Dock Icon with magnification ──────────────────────── */
const DockIcon = ({ label, visual, isRunning, isActive, onClick, onContextMenu, mouseX }) => {
  const ref = useRef(null);
  const distance = useTransform(mouseX, (value) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return 9999;
    const centerX = bounds.left + bounds.width / 2;
    return value - centerX;
  });
  const scaleTransform = useTransform(distance, [-200, 0, 200], [1, 1.22, 1]);
  const yTransform = useTransform(distance, [-200, 0, 200], [0, -7, 0]);

  const scale = useSpring(scaleTransform, { mass: 0.16, stiffness: 190, damping: 20 });
  const y = useSpring(yTransform, { mass: 0.15, stiffness: 180, damping: 18 });

  return (
    <motion.div
      className="dock-icon-wrap"
      ref={ref}
      style={{ y }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Tooltip */}
      <motion.div className="dock-tooltip">
        {label}
      </motion.div>

      {/* Icon */}
      {visual.svg ? (
        <motion.img
          className="dock-icon-img"
          src={visual.svg}
          alt={label}
          style={{
            scale,
          }}
          draggable={false}
          whileTap={{ scale: 0.85 }}
        />
      ) : (
        <motion.div
          className="dock-icon"
          style={{
            scale,
            background: visual.bg,
            color: visual.color || 'white',
          }}
          whileTap={{ scale: 0.85 }}
        >
          <span className="dock-icon-letter">{visual.letter}</span>
        </motion.div>
      )}

      {/* Active dot */}
      {isRunning && (
        <div className={`dock-dot ${isActive ? 'dock-dot-active' : ''}`} />
      )}
    </motion.div>
  );
};

/* ── Dock Component ───────────────────────────────────────────── */
const Dock = () => {
  const { runningApps, activeWindow, focusWindow, closeWindow, runAction } = useAppContext();
  const [contextMenu, setContextMenu] = useState(null);
  const [realIcons, setRealIcons] = useState({});
  const iconRequestsRef = useRef(new Set());
  const mouseX = useMotionValue(9999);

  // Filter out duplicates and get unique running apps by process name
  const uniqueRunning = [];
  const seenProcs = new Set();
  for (const app of runningApps) {
    const key = app.process_name?.toLowerCase();
    // Skip if it's a pinned app already
    const isPinned = pinnedApps.some(p =>
      (p.action === 'open_explorer' && key === 'explorer.exe') ||
      (p.action === 'open_terminal' && (key === 'windowsterminal.exe' || key === 'cmd.exe')) ||
      (p.action === 'open_browser' && (key === 'chrome.exe' || key === 'msedge.exe' || key === 'firefox.exe' || key === 'brave.exe')) ||
      (p.action === 'open_settings' && key === 'systemsettings.exe')
    );
    if (!seenProcs.has(key) && !isPinned) {
      seenProcs.add(key);
      uniqueRunning.push(app);
    }
  }
  uniqueRunning.sort((a, b) => {
    const aName = (a.process_name || '').toLowerCase();
    const bName = (b.process_name || '').toLowerCase();
    if (aName !== bName) return aName.localeCompare(bName);
    return (a.pid || 0) - (b.pid || 0);
  });

  const handleContextMenu = (e, app) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, app });
  };

  useEffect(() => {
    const candidates = Array.from(
      new Set(
        runningApps
          .map((app) => app?.process_path)
          .filter((path) => typeof path === 'string' && path.trim().length > 0),
      ),
    );

    candidates.forEach((processPath) => {
      if (realIcons[processPath] || iconRequestsRef.current.has(processPath)) {
        return;
      }
      iconRequestsRef.current.add(processPath);

      invoke('get_app_icon', { processPath })
        .then((iconDataUrl) => {
          if (typeof iconDataUrl === 'string' && iconDataUrl.startsWith('data:image/')) {
            setRealIcons((prev) => ({ ...prev, [processPath]: iconDataUrl }));
          }
        })
        .catch(() => {})
        .finally(() => {
          iconRequestsRef.current.delete(processPath);
        });
    });
  }, [runningApps, realIcons]);

  const explorerApp = runningApps.find((a) => a.process_name?.toLowerCase() === 'explorer.exe');
  const terminalApp = runningApps.find((a) =>
    ['windowsterminal.exe', 'cmd.exe', 'powershell.exe'].includes(a.process_name?.toLowerCase()),
  );
  const browserApp = runningApps.find((a) =>
    ['chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe'].includes(a.process_name?.toLowerCase()),
  );
  const settingsApp = runningApps.find((a) => a.process_name?.toLowerCase() === 'systemsettings.exe');

  return (
    <>
      <div className="dock-container">
        <motion.div
          className="dock-bar"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          onMouseMove={(e) => mouseX.set(e.clientX)}
          onMouseLeave={() => mouseX.set(9999)}
        >
          {/* Pinned Apps */}
          {pinnedApps.map((app) => {
            const match =
              app.action === 'open_explorer'
                ? explorerApp
                : app.action === 'open_terminal'
                  ? terminalApp
                  : app.action === 'open_browser'
                    ? browserApp
                    : settingsApp;

            const liveIcon = match?.process_path ? realIcons[match.process_path] : null;
            const visual = liveIcon ? { ...app, svg: liveIcon } : app;

            return (
              <DockIcon
                key={app.name}
                label={app.name}
                visual={visual}
                isRunning={false}
                isActive={false}
                onClick={() => runAction(app.action)}
                mouseX={mouseX}
              />
            );
          })}

          {/* Separator */}
          {uniqueRunning.length > 0 && <div className="dock-separator" />}

          {/* Running Apps */}
          {uniqueRunning.map((app) => {
            const fallbackVisual = getAppVisual(app.process_name);
            const realIcon = app.process_path ? realIcons[app.process_path] : null;
            const visual = realIcon ? { ...fallbackVisual, svg: realIcon } : fallbackVisual;
            const isActive = activeWindow?.pid === app.pid;
            const displayName = app.title?.length > 30 ? app.title.slice(0, 30) + '…' : app.title;
            return (
              <DockIcon
                key={app.hwnd}
                label={displayName || app.process_name}
                visual={visual}
                isRunning={true}
                isActive={isActive}
                onClick={() => focusWindow(app.hwnd)}
                onContextMenu={(e) => handleContextMenu(e, app)}
                mouseX={mouseX}
              />
            );
          })}

          {/* Separator before trash */}
          <div className="dock-separator" />

          {/* Trash */}
          <DockIcon
            label="Trash"
            visual={{
              svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="8" fill="#666"/>
                <rect x="14" y="16" width="36" height="4" rx="1" fill="#999"/>
                <path d="M18 24 L46 24 L44 52 Q44 54 42 54 L22 54 Q20 54 20 52 Z" fill="#888" stroke="#999" stroke-width="0.5"/>
                <line x1="26" y1="28" x2="26" y2="48" stroke="#aaa" stroke-width="1"/>
                <line x1="32" y1="28" x2="32" y2="48" stroke="#aaa" stroke-width="1"/>
                <line x1="38" y1="28" x2="38" y2="48" stroke="#aaa" stroke-width="1"/>
              </svg>`)
            }}
            isRunning={false}
            isActive={false}
            onClick={() => {}}
            mouseX={mouseX}
          />
        </motion.div>
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="context-backdrop" onClick={() => setContextMenu(null)} />
            <motion.div
              className="context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y - 80 }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.12 }}
            >
              <button onClick={() => { focusWindow(contextMenu.app.hwnd); setContextMenu(null); }}>
                Focus
              </button>
              <button onClick={() => { closeWindow(contextMenu.app.hwnd); setContextMenu(null); }}>
                Close
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Dock;