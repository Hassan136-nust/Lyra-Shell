import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Icon components (macOS-style)
const WifiIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path d="M10 3.5c-3.432 0-6.125 1.534-8.054 3.241a.75.75 0 001.048 1.073C4.7 6.38 7.16 5 10 5c2.84 0 5.3 1.38 7.006 2.814a.75.75 0 101.048-1.073C16.125 5.034 13.432 3.5 10 3.5zM4.678 9.322a.75.75 0 011.06.036C6.988 10.536 8.425 11.5 10 11.5s3.012-.964 4.262-2.142a.75.75 0 111.096 1.024C13.988 11.964 12.075 13 10 13s-3.988-1.036-5.358-2.618a.75.75 0 01.036-1.06zM10 14a2 2 0 100 4 2 2 0 000-4z"/>
  </svg>
);

const BatteryIcon = () => (
  <svg className="w-6 h-4" fill="currentColor" viewBox="0 0 24 20">
    <rect x="1" y="4" width="18" height="12" rx="2" ry="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <rect x="3" y="6" width="14" height="8" rx="1" fill="currentColor"/>
    <rect x="19" y="7.5" width="2" height="5" rx="1" fill="currentColor"/>
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 20 20" strokeWidth="2">
    <circle cx="8" cy="8" r="5"/>
    <path d="M12 12l4 4"/>
  </svg>
);

const TopBar = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 h-10 z-50 no-select"
    >
      <div className="lyra-topbar mx-3 mt-2 h-8 rounded-xl px-3 flex items-center justify-between text-white/90">
        <div className="flex items-center space-x-6">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.9)]" />
            <span className="font-semibold text-sm tracking-wide">Lyra</span>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <button className="lyra-menu-btn">File</button>
            <button className="lyra-menu-btn">Apps</button>
            <button className="lyra-menu-btn">Workspace</button>
            <button className="lyra-menu-btn">Help</button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 text-white/80">
            <button className="lyra-icon-btn">
              <SearchIcon />
            </button>
            <button className="lyra-icon-btn">
              <WifiIcon />
            </button>
            <button className="lyra-icon-btn">
              <BatteryIcon />
            </button>
          </div>
          <span className="text-sm font-medium text-white ml-2">
            {formatTime(currentTime)}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default TopBar;
