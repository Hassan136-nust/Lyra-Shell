import { motion } from 'framer-motion';
import TopBar from './components/TopBar';
import './App.css';

function App() {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Background - Wallpaper or gradient fallback */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0"
      >
        {/* Wallpaper Image - Place your image in public/wallpaper.jpg */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: 'url(/wallpaper.png)',
            // Fallback gradient if image not found
            backgroundColor: '#1a1a1a'
          }}
        />
        
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/50" />
        
        {/* Optional: Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
      </motion.div>

      {/* Top Bar */}
      <TopBar />

      {/* Main Content Area - Empty for Phase 1 */}
      <div className="relative z-10 flex items-center justify-center h-full pt-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center text-white/40"
        >
          <h1 className="text-6xl font-light mb-4">Lyra</h1>
          <p className="text-lg">Phase 1 - Desktop Shell</p>
        </motion.div>
      </div>
    </div>
  );
}

export default App;
