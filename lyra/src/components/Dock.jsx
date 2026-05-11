import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
  'chrome.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="28" fill="#fbbc05"/>
      <path d="M32 4 L56.24 18 C56.24 18 46.5 4 32 4 Z" fill="#ea4335"/>
      <path d="M32 60 C16.5 60 4 47.5 4 32 L28 32 C28 47.5 32 60 32 60 Z" fill="#34a853"/>
      <path d="M4 32 C4 16.5 16.5 4 32 4 L32 28 C16.5 28 4 32 4 32 Z" fill="#ea4335"/>
      <circle cx="32" cy="32" r="12" fill="#fff"/>
      <circle cx="32" cy="32" r="9" fill="#4285f4"/>
    </svg>`),
  },
  'msedge.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 4 C16.5 4 4 16.5 4 32 C4 47.5 16.5 60 32 60 C47.5 60 60 47.5 60 32 C60 16.5 47.5 4 32 4 Z" fill="#0078d7"/>
      <path d="M16 32 C16 20 28 20 28 20 C28 20 20 28 20 36 C20 44 32 48 40 40 C48 32 48 24 48 24 C48 24 48 40 32 52 C20 52 16 44 16 32 Z" fill="#1cf2a2"/>
      <path d="M32 12 C44 12 52 24 52 32 C52 44 44 48 44 48 C44 48 52 40 52 28 C52 16 40 16 40 16 C40 16 48 20 48 28 C48 36 36 40 28 36 C20 32 24 16 32 12 Z" fill="#00bcf2"/>
    </svg>`),
  },
  'discord.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#5865F2"/>
      <path d="M46 22 C42 20 38 19 38 19 L37 21 C42 22 44 24 44 24 C44 24 40 21 32 20 C24 21 20 24 20 24 C20 24 22 22 27 21 L26 19 C26 19 22 20 18 22 C14 34 16 46 16 46 C20 50 26 51 26 51 L28 48 C24 47 22 45 22 45 C22 45 24 46 32 47 C40 46 42 45 42 45 C42 45 40 47 36 48 L38 51 C38 51 44 50 48 46 C48 46 50 34 46 22 Z" fill="#fff"/>
      <circle cx="27" cy="34" r="3" fill="#5865F2"/>
      <circle cx="37" cy="34" r="3" fill="#5865F2"/>
    </svg>`),
  },
  'spotify.exe': {
    svg: createSvgIcon(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="28" fill="#1DB954"/>
      <path d="M18 42 C24 39 36 39 44 42" stroke="#191414" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M16 34 C24 30 40 30 48 35" stroke="#191414" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M14 24 C26 18 44 19 52 26" stroke="#191414" stroke-width="5" stroke-linecap="round" fill="none"/>
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
  
  // Memoize distance transform to avoid recalculation
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
  const [realIcons, setRealIcons] = useState({});
  const iconRequestsRef = useRef(new Set());
  const mouseX = useMotionValue(Infinity);
  const [contextMenu, setContextMenu] = useState(null);

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeout = useRef(null);

  const handleMouseEnter = useCallback(() => {
    clearTimeout(hoverTimeout.current);
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverTimeout.current = setTimeout(() => {
      setIsHovered(false);
    }, 300);
  }, []);

  // Memoize unique running apps to avoid recalculation on every render
  const uniqueRunning = useMemo(() => {
    const result = [];
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
        result.push(app);
      }
    }
    result.sort((a, b) => {
      const aName = (a.process_name || '').toLowerCase();
      const bName = (b.process_name || '').toLowerCase();
      if (aName !== bName) return aName.localeCompare(bName);
      return (a.pid || 0) - (b.pid || 0);
    });
    return result;
  }, [runningApps]);

  const handleContextMenu = useCallback((e, app) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, app });
  }, []);

  // Batch icon fetching with debouncing
  useEffect(() => {
    let disposed = false;
    const candidates = Array.from(
      new Set(
        runningApps
          .map((app) => app?.process_path)
          .filter((path) => typeof path === 'string' && path.trim().length > 0),
      ),
    );

    // Only batch request what we actually don't have yet
    const needed = candidates.filter((path) => !realIcons[path] && !iconRequestsRef.current.has(path));
    if (needed.length === 0) return;

    needed.forEach((p) => iconRequestsRef.current.add(p));

    // Debounce icon fetching to reduce backend calls
    const timeoutId = setTimeout(() => {
      invoke('get_app_icons_batch', { processPaths: needed })
        .then((results) => {
          if (!disposed && results) {
            setRealIcons((prev) => ({ ...prev, ...results }));
          }
        })
        .catch((e) => console.error("Dock icon fetch error:", e))
        .finally(() => {
          needed.forEach((p) => iconRequestsRef.current.delete(p));
        });
    }, 100);

    return () => {
      disposed = true;
      clearTimeout(timeoutId);
    };
  }, [runningApps, realIcons]);

  useEffect(() => () => {
    clearTimeout(hoverTimeout.current);
  }, []);

  // Memoize pinned app matches
  const explorerApp = useMemo(() => 
    runningApps.find((a) => a.process_name?.toLowerCase() === 'explorer.exe'),
    [runningApps]
  );
  const terminalApp = useMemo(() =>
    runningApps.find((a) =>
      ['windowsterminal.exe', 'cmd.exe', 'powershell.exe'].includes(a.process_name?.toLowerCase())
    ),
    [runningApps]
  );
  const browserApp = useMemo(() =>
    runningApps.find((a) =>
      ['chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe'].includes(a.process_name?.toLowerCase())
    ),
    [runningApps]
  );
  const settingsApp = useMemo(() =>
    runningApps.find((a) => a.process_name?.toLowerCase() === 'systemsettings.exe'),
    [runningApps]
  );

  return (
    <>
      <div
        className="dock-wrapper"
        onMouseLeave={() => {
          handleMouseLeave();
          mouseX.set(Infinity);
        }}
      >
        <div className="dock-trigger" onMouseEnter={handleMouseEnter} />
        <motion.div
          className="dock-animator"
          initial={{ y: 150 }}
          animate={{ y: isHovered ? 0 : 150 }}
          transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.45 }}
          onMouseEnter={handleMouseEnter}
        >
          <div className="dock-container">
            <motion.div
              className="dock-bar"
              onMouseMove={(e) => mouseX.set(e.clientX)}
              layout
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
                const processName = app.process_name || '';
                const fallbackVisual = getAppVisual(processName);
                const hasHardcodedSvg = !!processIconMap[processName];
                const realIcon = app.process_path ? realIcons[app.process_path] : null;

                // CRITICAL: Prioritize High-Res hardcoded SVGs over blurry RealIcons!
                const visual = hasHardcodedSvg ? fallbackVisual : (realIcon ? { ...fallbackVisual, svg: realIcon } : fallbackVisual);

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
