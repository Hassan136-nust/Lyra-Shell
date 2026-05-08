import { useState } from 'react';
import { motion } from 'framer-motion';

// SVG Icon Components
const FinderIcon = () => (
  <svg viewBox="0 0 64 64" className="w-full h-full">
    <defs>
      <linearGradient id="finderGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#4A9EEC', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#1E6BB8', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#finderGrad)" />
    <path d="M32 20 L45 32 L32 44 L19 32 Z" fill="white" opacity="0.9" />
    <circle cx="28" cy="32" r="3" fill="#1E6BB8" />
  </svg>
);

const MessagesIcon = () => (
  <svg viewBox="0 0 64 64" className="w-full h-full">
    <defs>
      <linearGradient id="msgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#5FD068', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#2FB134', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#msgGrad)" />
    <path d="M16 24 C16 20 20 16 32 16 C44 16 48 20 48 24 L48 36 C48 40 44 44 32 44 C28 44 24 44 20 46 L20 40 C17 40 16 38 16 36 Z" fill="white" />
  </svg>
);

const SafariIcon = () => (
  <svg viewBox="0 0 64 64" className="w-full h-full">
    <defs>
      <linearGradient id="safariGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#4FC3F7', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#0288D1', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#safariGrad)" />
    <circle cx="32" cy="32" r="18" fill="white" opacity="0.95" />
    <path d="M32 18 L35 32 L32 46 L29 32 Z" fill="#E53935" />
    <path d="M18 32 L32 29 L46 32 L32 35 Z" fill="white" />
  </svg>
);

const LaunchpadIcon = () => (
  <svg viewBox="0 0 64 64" className="w-full h-full">
    <defs>
      <linearGradient id="launchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#E0E0E0', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#9E9E9E', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#launchGrad)" />
    {[0, 1, 2].map(row => 
      [0, 1, 2].map(col => (
        <rect 
          key={`${row}-${col}`}
          x={16 + col * 12} 
          y={16 + row * 12} 
          width="8" 
          height="8" 
          rx="2" 
          fill="#4CAF50"
        />
      ))
    )}
  </svg>
);

const CalendarIcon = () => {
  const today = new Date().getDate();
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <rect width="64" height="64" rx="14" fill="white" />
      <rect width="64" height="18" rx="14" fill="#E53935" />
      <text x="32" y="42" fontSize="24" fontWeight="bold" textAnchor="middle" fill="#333">
        {today}
      </text>
      <text x="32" y="14" fontSize="8" fontWeight="bold" textAnchor="middle" fill="white">
        OCT
      </text>
    </svg>
  );
};

const MusicIcon = () => (
  <svg viewBox="0 0 64 64" className="w-full h-full">
    <defs>
      <linearGradient id="musicGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#FF4081', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#F50057', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#musicGrad)" />
    <path d="M42 16 L42 40 C42 44 38 46 35 46 C32 46 28 44 28 40 C28 36 32 34 35 34 C37 34 39 35 42 36 L42 24 L28 28 L28 46 C28 50 24 52 21 52 C18 52 14 50 14 46 C14 42 18 40 21 40 C23 40 25 41 28 42 L28 20 Z" fill="white" />
  </svg>
);

const PodcastsIcon = () => (
  <svg viewBox="0 0 64 64" className="w-full h-full">
    <defs>
      <linearGradient id="podGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#9C27B0', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#6A1B9A', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#podGrad)" />
    <circle cx="32" cy="28" r="6" fill="white" />
    <path d="M32 36 C28 36 24 34 24 30 M32 36 C36 36 40 34 40 30" stroke="white" strokeWidth="3" fill="none" />
    <path d="M32 42 C26 42 20 38 20 32 M32 42 C38 42 44 38 44 32" stroke="white" strokeWidth="3" fill="none" />
    <rect x="28" y="42" width="8" height="10" rx="2" fill="white" />
  </svg>
);

const TrashIcon = ({ isEmpty = true }) => (
  <svg viewBox="0 0 64 64" className="w-full h-full">
    <defs>
      <linearGradient id="trashGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#78909C', stopOpacity: 0.9 }} />
        <stop offset="100%" style={{ stopColor: '#455A64', stopOpacity: 0.9 }} />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="14" fill="url(#trashGrad)" />
    <path d="M20 24 L22 48 C22 50 24 52 26 52 L38 52 C40 52 42 50 42 48 L44 24 Z" fill="white" opacity="0.9" />
    <rect x="18" y="20" width="28" height="4" rx="2" fill="white" opacity="0.9" />
    <rect x="28" y="16" width="8" height="4" rx="1" fill="white" opacity="0.7" />
  </svg>
);

const Dock = () => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const apps = [
    { name: 'Finder', icon: FinderIcon },
    { name: 'Messages', icon: MessagesIcon },
    { name: 'Safari', icon: SafariIcon },
    { name: 'Launchpad', icon: LaunchpadIcon },
    { name: 'Calendar', icon: CalendarIcon },
    { name: 'Music', icon: MusicIcon },
    { name: 'Podcasts', icon: PodcastsIcon },
  ];

  return (
    <div className="fixed left-1/2 z-50" style={{ bottom: '8px', transform: 'translateX(-50%)' }}>
      <div
        className="relative bg-gray-800/60 backdrop-blur-2xl rounded-[22px] shadow-2xl px-2 py-2"
        style={{
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <div className="flex items-end justify-center gap-2" style={{ height: '80px' }}>
          {apps.map((app, index) => {
            const isHovered = hoveredIndex === index;
            const size = isHovered ? 72 : 58;
            const IconComponent = app.icon;
            
            return (
              <motion.button
                key={app.name}
                className="relative rounded-[16px] overflow-hidden"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                }}
                animate={{
                  width: `${size}px`,
                  height: `${size}px`,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 600,
                  damping: 30,
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                title={app.name}
              >
                <IconComponent />
                
                {/* Active indicator dot */}
                {index < 3 && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white/90 rounded-full" />
                )}
              </motion.button>
            );
          })}
          
          {/* Separator */}
          <div className="h-12 w-[1px] bg-white/20 mx-1 self-end mb-1" />
          
          {/* Trash */}
          <motion.button
            className="relative rounded-[16px] overflow-hidden"
            style={{
              width: hoveredIndex === apps.length ? '72px' : '58px',
              height: hoveredIndex === apps.length ? '72px' : '58px',
            }}
            animate={{
              width: hoveredIndex === apps.length ? '72px' : '58px',
              height: hoveredIndex === apps.length ? '72px' : '58px',
            }}
            transition={{
              type: 'spring',
              stiffness: 600,
              damping: 30,
            }}
            onMouseEnter={() => setHoveredIndex(apps.length)}
            title="Trash"
          >
            <TrashIcon />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default Dock;
