import TopBar from './components/TopBar';
import Dock from './components/Dock';
import './App.css';

function App() {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Wallpaper Background */}
      <img 
        src="/wallpaper.png" 
        alt="Desktop Wallpaper"
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.parentElement.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }}
      />

      {/* Top Menu Bar */}
      <TopBar />

      {/* Left Dock */}
      <Dock />
    </div>
  );
}

export default App;
