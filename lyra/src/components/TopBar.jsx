import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const TopBar = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
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
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 h-8 bg-black/30 backdrop-blur-2xl border-b border-white/10 z-40"
    >
      <div className="flex items-center justify-between h-full px-4">
        {/* Left: App Menu */}
        <div className="flex items-center gap-6 text-sm text-white/90">
          <span className="font-bold">Lyra</span>
          <button className="hover:text-white transition-colors">File</button>
          <button className="hover:text-white transition-colors">Edit</button>
          <button className="hover:text-white transition-colors">View</button>
          <button className="hover:text-white transition-colors">Window</button>
          <button className="hover:text-white transition-colors">Help</button>
        </div>

        {/* Right: Status Icons & Clock */}
        <div className="flex items-center gap-4 text-white/90">
          <button className="hover:bg-white/10 p-1 rounded transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3.5c-3.432 0-6.125 1.534-8.054 3.241a.75.75 0 001.048 1.073C4.7 6.38 7.16 5 10 5c2.84 0 5.3 1.38 7.006 2.814a.75.75 0 101.048-1.073C16.125 5.034 13.432 3.5 10 3.5z"/>
            </svg>
          </button>
          <button className="hover:bg-white/10 p-1 rounded transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M15 8a3 3 0 10-6 0v2H7a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1v-6a1 1 0 00-1-1h-2V8z"/>
            </svg>
          </button>
          <span className="text-sm font-medium">{formatTime(time)}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default TopBar;
