# Lyra Phase 1 - Quick Start

## 🎯 What You're Building

A fullscreen desktop shell with:
1. ✅ Fullscreen borderless window
2. ✅ macOS-style top bar with live clock

## 📦 Installation Steps

### 1. Install Prerequisites

**Windows:**
```bash
# Install Rust
winget install Rustlang.Rustup

# Install Node.js
winget install OpenJS.NodeJS
```

**Or download manually:**
- Rust: https://rustup.rs/
- Node.js: https://nodejs.org/

### 2. Install Dependencies

```bash
npm install
```

This installs:
- React + Vite
- Tauri CLI
- Tailwind CSS
- Framer Motion

### 3. Run Development Server

```bash
npm run tauri dev
```

**First run takes 2-5 minutes** (Rust compilation)
**Subsequent runs are instant** (hot reload)

## ✅ What You Should See

1. A fullscreen window opens
2. Dark gradient background
3. Top bar with:
   - Left: "Lyra" text
   - Center: Live clock (updates every second)
   - Right: WiFi, Battery, Search icons
4. Center: "Lyra Phase 1" text

## 🔧 Making Changes

### Edit the Top Bar

**File:** `src/components/TopBar.jsx`

```jsx
// Change app name
<span className="font-semibold">Lyra</span>
// Change to:
<span className="font-semibold">Your Name</span>
```

**Save → Changes appear instantly!**

### Change Background Color

**File:** `src/App.jsx`

```jsx
// Current gradient
className="... from-lyra-darker via-lyra-dark to-gray-900"

// Try different colors
className="... from-blue-900 via-purple-900 to-pink-900"
```

### Adjust Top Bar Height

**File:** `src/components/TopBar.jsx`

```jsx
// Current height
className="... h-8 ..."

// Make it taller
className="... h-12 ..."
```

## 🎨 Customization Ideas

### Add a Background Image

1. Place image in `public/wallpaper.jpg`
2. Edit `src/App.jsx`:

```jsx
<div className="absolute inset-0 bg-cover bg-center"
     style={{ backgroundImage: 'url(/wallpaper.jpg)' }}>
  <div className="absolute inset-0 bg-black/50" /> {/* Overlay */}
</div>
```

### Change Icon Colors

**File:** `src/components/TopBar.jsx`

```jsx
// Current
<div className="... text-white/80">

// Brighter
<div className="... text-white">

// Colored
<div className="... text-blue-400">
```

### Add Hover Effects

Icons already have hover effects! Try hovering over WiFi/Battery/Search.

## 🐛 Troubleshooting

### Window Not Fullscreen?

Check `tauri.conf.json`:
```json
"fullscreen": true,
"decorations": false
```

### Tailwind Styles Not Working?

1. Check `tailwind.config.js` exists
2. Check `src/index.css` has `@tailwind` directives
3. Restart dev server: `Ctrl+C` then `npm run tauri dev`

### Hot Reload Not Working?

1. Save the file again
2. Check terminal for errors
3. Restart: `Ctrl+C` then `npm run tauri dev`

### Port 1420 Already in Use?

Kill the process:
```bash
# Windows
netstat -ano | findstr :1420
taskkill /PID <PID> /F
```

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `src/App.jsx` | Main layout & background |
| `src/components/TopBar.jsx` | Top bar component |
| `src/index.css` | Global styles + Tailwind |
| `tauri.conf.json` | Window configuration |
| `tailwind.config.js` | Tailwind theme |

## 🚀 Next Steps (Phase 2)

After you're comfortable with Phase 1:
- Add a dock at the bottom
- Add app launcher (Spotlight-style)
- Add window management
- Add system tray integration

## 💡 Tips

1. **Keep dev server running** - Changes appear instantly
2. **Use Tailwind classes** - Faster than writing CSS
3. **Check browser console** - Press F12 in Tauri window
4. **Git commit often** - Save your progress

## 🎓 Learning Resources

- **Tailwind CSS:** https://tailwindcss.com/docs
- **Framer Motion:** https://www.framer.com/motion/
- **React Hooks:** https://react.dev/reference/react
- **Tauri Docs:** https://tauri.app/v1/guides/

## ❓ Common Questions

**Q: Can I resize the window?**
A: Not in Phase 1. It's fullscreen only. Change `resizable: true` in `tauri.conf.json` to enable.

**Q: How do I exit the app?**
A: Press `Alt+F4` or close from taskbar.

**Q: Can I test without fullscreen?**
A: Yes! In `tauri.conf.json`, change:
```json
"fullscreen": false,
"width": 1200,
"height": 800
```

**Q: Why is first build slow?**
A: Rust compiles everything first time. Subsequent builds are fast.

## 🎉 You're Ready!

Run `npm run tauri dev` and start building!
