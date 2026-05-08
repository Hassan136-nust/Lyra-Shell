# Lyra Phase 1 - Folder Structure

```
lyra/
├── src/                          # React frontend
│   ├── components/               # React components
│   │   └── TopBar.jsx           # Top bar component
│   ├── App.jsx                  # Main app component
│   ├── App.css                  # App styles
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles + Tailwind
│
├── src-tauri/                    # Tauri backend (Rust)
│   ├── src/
│   │   └── main.rs              # Tauri window configuration
│   ├── tauri.conf.json          # Tauri app configuration
│   └── Cargo.toml               # Rust dependencies
│
├── public/                       # Static assets
│   └── wallpaper.jpg            # Background image (optional)
│
├── tailwind.config.js           # Tailwind configuration
├── postcss.config.js            # PostCSS configuration
├── vite.config.js               # Vite configuration
├── package.json                 # Node dependencies
└── README.md                    # Project documentation
```

## Files You'll Create/Edit in Phase 1

### Frontend (React)
1. `src/index.css` - Tailwind setup + global styles
2. `src/App.jsx` - Main desktop shell layout
3. `src/components/TopBar.jsx` - Top bar component

### Backend (Tauri)
1. `src-tauri/tauri.conf.json` - Window configuration
2. `tailwind.config.js` - Tailwind setup

## Files You Won't Touch Yet
- `src-tauri/src/main.rs` (default is fine for Phase 1)
- `vite.config.js` (default is fine)
- `postcss.config.js` (auto-generated)
