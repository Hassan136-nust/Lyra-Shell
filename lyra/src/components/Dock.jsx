import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, useSpring, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../contexts/AppContext';

/* ── SVG Icon Generator ───────────────────────────────────────── */
// Generate high-quality SVG icons at 256x256 for crisp display like Seelen UI
const createSvgIcon = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/* ── App icon mapping by process name ─────────────────────────── */
// Removed hardcoded SVG icons - we now use real Windows icons from IShellItemImageFactory
const processIconMap = {};

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
// Paths will be fetched dynamically from system
const pinnedApps = [
  { name: 'Files', action: 'open_explorer', key: 'explorer' },
  { name: 'Terminal', action: 'open_terminal', key: 'terminal' },
  { name: 'Browser', action: 'open_browser', key: 'browser' },
  { name: 'Settings', action: 'open_settings', key: 'settings' },
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
  const [systemPaths, setSystemPaths] = useState({});
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

  // Fetch system app paths on mount
  useEffect(() => {
    invoke('get_system_app_paths')
      .then((paths) => setSystemPaths(paths))
      .catch((e) => console.error("Failed to get system paths:", e));
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

    // Batch icon fetching with debouncing - include pinned app paths
  useEffect(() => {
    let disposed = false;
    
    // Collect all paths: running apps + pinned apps
    const runningPaths = runningApps
      .map((app) => app?.process_path)
      .filter((path) => typeof path === 'string' && path.trim().length > 0);
    
    // Add pinned app paths from system
    const pinnedPaths = Object.values(systemPaths);
    
    const candidates = Array.from(new Set([...runningPaths, ...pinnedPaths]));

    // Only batch request what we actually don't have yet
    const needed = candidates.filter((path) => !realIcons[path] && !iconRequestsRef.current.has(path));
    if (needed.length === 0) return;

    needed.forEach((p) => iconRequestsRef.current.add(p));

    // Debounce icon fetching to reduce backend calls
    const timeoutId = setTimeout(() => {
      console.log('[Dock] Fetching icons for paths:', needed);
      invoke('get_app_icons_batch', { processPaths: needed })
        .then((results) => {
          if (!disposed && results) {
            console.log('[Dock] Received icons:', Object.keys(results).length, 'icons');
            console.log('[Dock] Icon data sample:', Object.keys(results).slice(0, 2));
            setRealIcons((prev) => ({ ...prev, ...results }));
          }
        })
        .catch((e) => {
          console.error("[Dock] Icon fetch error:", e);
        })
        .finally(() => {
          needed.forEach((p) => iconRequestsRef.current.delete(p));
        });
    }, 100);

    return () => {
      disposed = true;
      clearTimeout(timeoutId);
    };
  }, [runningApps, realIcons, systemPaths]);

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

                // Try to get real icon from running app first, then from system path
                let realIcon = match?.process_path ? realIcons[match.process_path] : null;
                
                // If not running, use the system path for this app
                if (!realIcon && systemPaths[app.key]) {
                  realIcon = realIcons[systemPaths[app.key]];
                }
                
                const visual = realIcon ? { svg: realIcon } : getAppVisual(app.name);

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
                
                // Always prefer real Windows icon from IShellItemImageFactory
                const realIcon = app.process_path ? realIcons[app.process_path] : null;
                const visual = realIcon ? { svg: realIcon } : getAppVisual(processName);

                // Debug: Log icon status for each app
                if (app.process_path) {
                  const hasIcon = !!realIcons[app.process_path];
                  const iconPreview = realIcons[app.process_path]?.substring(0, 50);
                  console.log(`[Dock] ${processName}: hasIcon=${hasIcon}, path=${app.process_path}, preview=${iconPreview}`);
                }

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
