# Lyra Desktop Shell

<div align="center">

![Lyra Logo](lyra/docs/images/logo.png)

**A modern, custom desktop shell for Windows built with Tauri v2, React, and Tailwind CSS**

*Arch minimalism. macOS polish. Windows power.*

</div>

---

## 🎯 What is Lyra?

Lyra is a **custom desktop shell replacement** for Windows that provides a completely new user interface while keeping the Windows kernel and system intact. Think of it as a beautiful skin over Windows that changes how you interact with your desktop.

### Key Features

- ✅ **Custom Top Bar** - Arch Linux-style menu bar with real system information
- ✅ **macOS-style Dock** - Bottom dock with app icons and smooth hover effects
- ✅ **Real System Integration** - Live WiFi networks, battery status, system info
- ✅ **Custom Wallpaper** - Your own background image
- ✅ **Glassmorphism UI** - Modern blur effects and transparency
- ✅ **Smooth Animations** - Framer Motion powered transitions

---

## 📸 Screenshots

### Desktop View
- Clean wallpaper background
- Top bar with system tray
- Bottom dock with pinned apps

### Top Bar Features
- App name and menu items (File, Edit, View, Help)
- WiFi network list with real data
- Battery indicator with charging status
- Live clock with date/time
- System information (CPU, RAM)

### Dock Features
- Chrome, File Explorer, Settings, Launchpad icons
- Recycle Bin
- Hover to enlarge effect
- Active app indicators

---

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI library
- **Vite 7** - Build tool & dev server
- **Tailwind CSS 4** - Utility-first styling
- **Framer Motion 12** - Animation library

### Backend
- **Tauri v2** - Native app framework (Rust)
- **Rust** - System-level programming
- **Windows API** - System integration

### System Integration
- **netsh** - WiFi network scanning and connection
- **PowerShell** - Audio control
- **Navigator Battery API** - Battery status
- **sysinfo crate** - CPU and RAM monitoring

---

## 📦 Installation & Setup

### Prerequisites

**Required:**
1. **Node.js** (v18+) - [Download](https://nodejs.org/)
2. **Rust** - [Install via rustup](https://rustup.rs/)
3. **Visual Studio Build Tools** - Required for Rust on Windows
   - Download: https://aka.ms/vs/17/release/vs_BuildTools.exe
   - Select "Desktop development with C++"
   - Install and restart your computer

### Quick Start

```bash
# 1. Clone or download the project
cd lyra

# 2. Install dependencies
npm install

# 3. Run development server
npm run tauri dev
```

**First run takes 2-5 minutes** (Rust compilation)

**Subsequent runs are instant** (hot reload enabled)

---

## 📁 Project Structure

```
lyra/
├── src/                          # React frontend
│   ├── components/
│   │   ├── TopBar.jsx           # Top menu bar with system tray
│   │   ├── TopBarSimple.jsx     # Simplified top bar (alternative)
│   │   └── Dock.jsx             # Bottom dock with app icons
│   ├── App.jsx                  # Main app component
│   ├── App.css                  # App styles
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles + Tailwind
│
├── src-tauri/                    # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs              # Entry point
│   │   └── lib.rs               # System commands (WiFi, audio, etc.)
│   ├── tauri.conf.json          # Tauri configuration
│   └── Cargo.toml               # Rust dependencies
│
├── public/                       # Static assets
│   └── wallpaper.png            # Desktop background
│
├── docs/                         # Documentation
│   └── images/
│       └── logo.png             # Project logo
│
├── tailwind.config.js           # Tailwind configuration
├── vite.config.js               # Vite configuration
├── package.json                 # Node dependencies
└── README.md                    # This file
```

---

## 🎨 Customization

### Change Wallpaper

1. Place your image in `lyra/public/wallpaper.png`
2. Supported formats: PNG, JPG, WEBP
3. Recommended resolution: 1920x1080 or higher

### Modify Dock Apps

Edit `lyra/src/components/Dock.jsx`:

```javascript
const apps = [
  { name: 'Chrome', emoji: '🌐', gradient: 'from-blue-400 to-blue-600' },
  { name: 'File Explorer', emoji: '📂', gradient: 'from-yellow-400 to-yellow-600' },
  // Add your own apps here
];
```

### Change Colors

Edit `lyra/tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      'lyra-dark': '#1a1a1a',
      'lyra-accent': '#3b82f6',
      // Add your colors
    },
  },
}
```

---

## 🔧 Available System Commands

### WiFi Control

```javascript
import { invoke } from '@tauri-apps/api/core';

// List available networks
const networks = await invoke('list_wifi_networks');
// Returns: [{ ssid: "Network Name", signal: 85, connected: false }, ...]

// Get current WiFi status
const status = await invoke('wifi_status');
// Returns: { connected: true, ssid: "Current Network", signal: 90 }

// Connect to a network
await invoke('connect_wifi', { ssid: 'Network Name' });
```

### Audio Control

```javascript
// Get volume (0-100)
const volume = await invoke('get_volume');

// Set volume
await invoke('set_volume', { value: 75 });

// Get mute status
const isMuted = await invoke('get_mute');

// Toggle mute
await invoke('set_mute', { value: true });
```

### System Actions

```javascript
// Open applications
await invoke('run_system_action', { action: 'open_explorer' });
await invoke('run_system_action', { action: 'open_terminal' });
await invoke('run_system_action', { action: 'open_settings' });

// Power actions
await invoke('run_system_action', { action: 'lock' });
await invoke('run_system_action', { action: 'sleep' });
await invoke('run_system_action', { action: 'restart' });
await invoke('run_system_action', { action: 'shutdown' });
```

### System Information

```javascript
const info = await invoke('get_system_info');
// Returns: {
//   cpu_usage: 45.2,
//   memory_used_gb: 8.5,
//   memory_total_gb: 16.0,
//   memory_percent: 53.1
// }
```

---

## 🚀 Building for Production

```bash
# Build installer
npm run tauri build
```

Output location: `src-tauri/target/release/bundle/`

### Installer Types
- **Windows:** `.exe` (NSIS installer)
- **Portable:** `.msi` (Windows Installer)

### Code Signing (Optional)

For production distribution without security warnings:

1. Purchase a code signing certificate ($200-400/year)
2. Configure in `tauri.conf.json`
3. Rebuild with signing enabled

---

## 🐛 Troubleshooting

### Issue: Build Tools Error

**Error:** `linker link.exe not found`

**Solution:** Install Visual Studio Build Tools
1. Download: https://aka.ms/vs/17/release/vs_BuildTools.exe
2. Select "Desktop development with C++"
3. Restart computer

See `lyra/FIX_BUILD_TOOLS.md` for detailed guide.

### Issue: Wallpaper Not Showing

**Solution:**
1. Check file exists: `lyra/public/wallpaper.png`
2. Restart dev server: `Ctrl+C` then `npm run tauri dev`
3. Hard refresh: `Ctrl+Shift+R` in the app

### Issue: WiFi Networks Not Loading

**Solution:**
1. Run as Administrator (WiFi scanning requires elevated permissions)
2. Check Windows Firewall settings
3. Verify `netsh wlan show networks` works in CMD

### Issue: Hot Reload Not Working

**Solution:**
1. Stop dev server (`Ctrl+C`)
2. Clear cache: `rm -rf node_modules/.vite`
3. Restart: `npm run tauri dev`

---

## 📚 Documentation Files

- **[PROJECT_REQUIREMENTS.md](PROJECT_REQUIREMENTS.md)** - Full project requirements and feasibility
- **[PHASE_1_SETUP.md](PHASE_1_SETUP.md)** - Phase 1 setup guide
- **[PHASE_1_FOLDER_STRUCTURE.md](PHASE_1_FOLDER_STRUCTURE.md)** - Folder structure explanation
- **[QUICK_START.md](QUICK_START.md)** - Quick reference guide
- **[lyra/FIX_BUILD_TOOLS.md](lyra/FIX_BUILD_TOOLS.md)** - Visual Studio Build Tools setup
- **[lyra/ISSUES_FIXED.md](lyra/ISSUES_FIXED.md)** - Common issues and solutions
- **[lyra/WALLPAPER_SETUP.md](lyra/WALLPAPER_SETUP.md)** - Wallpaper customization guide
- **[lyra/SYSTEM_INTEGRATION.md](lyra/SYSTEM_INTEGRATION.md)** - System integration details

---

## 🗺️ Roadmap

### Phase 1 (Current) ✅
- [x] Fullscreen window setup
- [x] Top bar with system tray
- [x] Bottom dock with app icons
- [x] Custom wallpaper support
- [x] WiFi network integration
- [x] Battery status
- [x] System information (CPU, RAM)

### Phase 2 (Planned)
- [ ] Window management (minimize, maximize, close)
- [ ] Virtual desktops/workspaces
- [ ] App launcher (Spotlight-style)
- [ ] Desktop icons
- [ ] File manager integration
- [ ] Notification center

### Phase 3 (Future)
- [ ] Themes & customization panel
- [ ] Widgets system
- [ ] Keyboard shortcuts
- [ ] Multi-monitor support
- [ ] Auto-update system
- [ ] Plugin architecture

---

## 🤝 Contributing

This is a personal learning project, but contributions are welcome!

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

### Inspiration
- **Seelen UI** - Windows shell replacement concept
- **macOS** - Dock design and animations
- **Arch Linux** - Minimal aesthetic and top bar design

### Technologies
- **Tauri** - For making native desktop apps with web tech
- **React** - UI library
- **Tailwind CSS** - Styling framework
- **Framer Motion** - Animation library

---

## 💡 Tips & Best Practices

### Development

1. **Keep dev server running** - Changes appear instantly with hot reload
2. **Use Tailwind classes** - Faster than writing custom CSS
3. **Check browser console** - Press F12 in Tauri window for debugging
4. **Git commit often** - Save your progress regularly

### Performance

1. **Optimize images** - Compress wallpapers to reduce app size
2. **Lazy load components** - Use React.lazy() for better startup time
3. **Minimize re-renders** - Use React.memo() for expensive components
4. **Profile with DevTools** - Check performance tab for bottlenecks

### Security

1. **Never commit secrets** - Use .env files (already in .gitignore)
2. **Validate user input** - Always sanitize data from forms
3. **Use Tauri allowlist** - Only enable needed APIs in tauri.conf.json
4. **Keep dependencies updated** - Run `npm audit` regularly

---

## 📞 Support & Community

### Get Help

- **Issues:** Open an issue on GitHub
- **Discussions:** Use GitHub Discussions for questions
- **Documentation:** Check the docs/ folder

### Useful Links

- **Tauri Docs:** https://tauri.app/
- **React Docs:** https://react.dev/
- **Tailwind CSS:** https://tailwindcss.com/
- **Framer Motion:** https://www.framer.com/motion/

---

## 🎉 Getting Started

Ready to build your custom desktop shell?

```bash
cd lyra
npm install
npm run tauri dev
```

**Welcome to Lyra!** 🚀

---

<div align="center">

Made with ❤️ using Tauri, React, and Tailwind CSS

**Arch minimalism. macOS polish. Windows power.**

</div>
