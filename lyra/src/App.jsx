import TopBar from './components/TopBar';
import Dock from './components/Dock';
import LockScreen from './components/LockScreen';
import { AppProvider, useAppContext } from './contexts/AppContext';
import './App.css';

function LockOverlay() {
  const { isLocked, unlockScreen } = useAppContext();
  return <LockScreen isLocked={isLocked} onUnlock={unlockScreen} />;
}

function App() {
  return (
    <AppProvider>
      <div className="lyra-shell">
        {/* Wallpaper Background */}
        <div className="lyra-wallpaper">
          <img
            src="/wallpaper1.png"
            alt="Desktop"
            className="lyra-wallpaper-img"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          {/* Subtle overlay for better contrast with UI elements */}
          <div className="lyra-wallpaper-overlay" />
        </div>

        {/* Top Bar — Arch Linux style */}
        <TopBar />

        {/* Bottom Dock — macOS style */}
        <Dock />

        {/* Lock Screen Overlay */}
        <LockOverlay />
      </div>
    </AppProvider>
  );
}

export default App;
