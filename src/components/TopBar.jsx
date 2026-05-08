import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// Icon components (simple SVG placeholders)
const WifiIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
  </svg>
);

const BatteryIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const TopBar = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time as HH:MM AM/PM
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format date as Day, Month Date
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 h-8 bg-black/40 backdrop-blur-md border-b border-white/10 z-50 no-select"
    >
      <div className="flex items-center justify-between h-full px-4 text-white text-sm">
        {/* Left: App Name */}
        <div className="flex items-center space-x-4">
          <span className="font-semibold">Lyra</span>
        </div>

        {/* Center: Clock */}
        <div className="flex flex-col items-center">
          <span className="font-medium">{formatTime(currentTime)}</span>
          <span className="text-xs text-white/60">{formatDate(currentTime)}</span>
        </div>

        {/* Right: Status Icons */}
        <div className="flex items-center space-x-4 text-white/80">
          <button className="hover:text-white transition-colors">
            <WifiIcon />
          </button>
          <button className="hover:text-white transition-colors">
            <BatteryIcon />
          </button>
          <button className="hover:text-white transition-colors">
            <SearchIcon />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default TopBar;
