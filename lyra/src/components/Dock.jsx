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
      <defs>
        <linearGradient id="folderBack" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fdc940"/>
          <stop offset="100%" stop-color="#f8a705"/>
        </linearGradient>
        <linearGradient id="folderFront" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffe67a"/>
          <stop offset="100%" stop-color="#fcc42e"/>
        </linearGradient>
      </defs>
      <path d="M4 14 C4 10.686 6.686 8 10 8 L24 8 C26.652 8 29.195 9.053 31.071 10.929 L34 13.858 C35.408 15.265 37.316 16.056 39.308 16.056 L54 16.056 C57.314 16.056 60 18.742 60 22.056 L60 52 C60 55.314 57.314 58 54 58 L10 58 C6.686 58 4 55.314 4 52 L4 14 Z" fill="url(#folderBack)"/>
      <path d="M4 26 C4 23.791 5.791 22 8 22 L56 22 C58.209 22 60 23.791 60 26 L60 52 C60 55.313 57.313 58 54 58 L10 58 C6.686 58 4 55.314 4 52 L4 26 Z" fill="url(#folderFront)"/>
      <rect x="22" y="32" width="20" height="6" rx="3" fill="#3b82f6" opacity="0.8"/>
    </svg>`),
  },
  'SystemSettings.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#f3f4f6"/>
      <path d="M32 14 C34.5 14 36.5 15.5 37 17.5 C39 18 41.5 19 43 20.5 C44 19 46.5 18 48.5 19.5 C50.5 21 50 24.5 49.5 26 C51 27.5 52 29.5 52.5 32 C52.5 34.5 51 36.5 49.5 38 C50 39.5 50.5 43 48.5 44.5 C46.5 46 44 45 43 43.5 C41.5 45 39 46 37 46.5 C36.5 48.5 34.5 50 32 50 C29.5 50 27.5 48.5 27 46.5 C25 46 22.5 45 21 43.5 C20 45 17.5 46 15.5 44.5 C13.5 43 14 39.5 14.5 38 C13 36.5 12 34.5 11.5 32 C11.5 29.5 13 27.5 14.5 26 C14 24.5 13.5 21 15.5 19.5 C17.5 18 20 19 21 20.5 C22.5 19 25 18 27 17.5 C27.5 15.5 29.5 14 32 14 Z" fill="#0078d4"/>
      <circle cx="32" cy="32" r="9" fill="#f3f4f6"/>
    </svg>`),
  },
  'Battle.net.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#14181c"/>
      <circle cx="28" cy="38" r="6" fill="#00aeff"/>
      <circle cx="40" cy="28" r="8" fill="#00aeff"/>
      <circle cx="38" cy="46" r="4" fill="#00aeff"/>
      <circle cx="22" cy="26" r="4" fill="#00aeff" opacity="0.6"/>
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
  'Code.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path d="M46.5 12.5 L34 5 L14 21 L14 43 L34 59 L46.5 51.5 C48 50.5 49 48.5 49 46.5 L49 17.5 C49 15.5 48 13.5 46.5 12.5 Z" fill="#007acc"/>
      <path d="M49 17.5 L24 32 L49 46.5 Z" fill="#005a9e"/>
      <path d="M34 5 L49 17.5 L49 46.5 L34 59" fill="#1f9cf0"/>
      <polygon points="14,21 24,32 14,43" fill="#004a80"/>
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
  const scaleTransform = useTransform(distance, [-160, 0, 160], [1, 1.45, 1]);
  const yTransform = useTransform(distance, [-160, 0, 160], [0, -12, 0]);

  const scale = useSpring(scaleTransform, { mass: 0.12, stiffness: 220, damping: 16 });
  const y = useSpring(yTransform, { mass: 0.12, stiffness: 220, damping: 16 });

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
        .catch(() => { })
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
            onClick={() => { }}
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