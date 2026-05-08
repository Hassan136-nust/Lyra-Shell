# Lyra Phase 1 - Setup Guide

## 🚀 Quick Start Commands

### 1. Create Tauri + React Project

```bash
# Create new Tauri app with React + Vite
npm create tauri-app@latest

# When prompted, choose:
# - Project name: lyra
# - Package manager: npm (or your preference)
# - UI template: React
# - UI flavor: TypeScript (recommended) or JavaScript
# - Add Vite? Yes
```

### 2. Navigate and Install Dependencies

```bash
cd lyra
npm install
```

### 3. Install Tailwind CSS

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 4. Install Framer Motion (for subtle animations)

```bash
npm install framer-motion
```

## 🏃 Run Development Server

```bash
npm run tauri dev
```

**This will:**
- Start Vite dev server (frontend)
- Launch Tauri window (native app)
- Enable hot reload (changes appear instantly)

## ✅ Verify Setup

You should see:
- A Tauri window opens
- Fullscreen borderless window
- Dark background
- Top bar with "Lyra", clock, and icons

## 🔄 Development Workflow

1. Edit React components in `src/`
2. Save file
3. Changes appear instantly (hot reload)
4. No need to restart

## 📦 Build for Production (Later)

```bash
npm run tauri build
```

This creates an installer in `src-tauri/target/release/bundle/`
