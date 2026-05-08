# Fix: Visual Studio Build Tools Required

## ❌ Error You're Seeing

```
error: linker `link.exe` not found
note: the msvc targets depend on the msvc linker but `link.exe` was not found
note: please ensure that Visual Studio 2017 or later, or Build Tools for Visual Studio were installed with the Visual C++ option
```

## ✅ Solution: Install Visual Studio Build Tools

Rust on Windows requires the Microsoft C++ build tools to compile native code.

### Option 1: Quick Install (Recommended)

**Download and run:**
https://aka.ms/vs/17/release/vs_BuildTools.exe

**When the installer opens:**
1. Select **"Desktop development with C++"**
2. Make sure these are checked in the right panel:
   - ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools
   - ✅ Windows 11 SDK (or Windows 10 SDK)
3. Click **Install**
4. Wait 5-10 minutes for installation
5. **Restart your terminal/VS Code**

### Option 2: Using winget (Command Line)

```bash
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

### Option 3: Full Visual Studio (If you want the IDE)

```bash
winget install Microsoft.VisualStudio.2022.Community
```

Then install the "Desktop development with C++" workload.

## 🔄 After Installation

1. **Close all terminals and VS Code**
2. **Reopen VS Code**
3. **Navigate to your project:**
   ```bash
   cd lyra
   ```
4. **Try running again:**
   ```bash
   npm run tauri dev
   ```

## ✅ Verify Installation

Check if the tools are installed:

```bash
# Check for cl.exe (C++ compiler)
where cl

# Should show path like:
# C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\...\cl.exe
```

## 📦 Disk Space Required

- **Build Tools only:** ~6-8 GB
- **Full Visual Studio:** ~10-15 GB

## ⏱️ Installation Time

- Download: 2-5 minutes (depending on internet)
- Installation: 5-10 minutes

## 🐛 Still Having Issues?

### Issue: "cl.exe not found" after installation

**Solution:** Restart your computer (not just terminal)

### Issue: Installation failed

**Solution:** 
1. Uninstall any partial installations
2. Run installer as Administrator
3. Try again

### Issue: Wrong SDK version

**Solution:**
Install Windows 10 SDK separately:
```bash
winget install Microsoft.WindowsSDK.10
```

## 🎯 Once Fixed

After successful installation, you should see:

```bash
npm run tauri dev

# Output:
Compiling proc-macro2 v1.0.106
Compiling quote v1.0.45
...
Finished dev [unoptimized + debuginfo] target(s) in 2m 30s
```

First compilation takes 2-5 minutes. Subsequent runs are instant!

## 💡 Why Is This Needed?

- **Tauri** is built with Rust
- **Rust** on Windows uses Microsoft's C++ toolchain
- **link.exe** is the linker that combines compiled code
- This is a **one-time setup** - you won't need to do this again

## 🚀 Alternative: Use WSL2 (Advanced)

If you prefer Linux-style development:

1. Install WSL2: `wsl --install`
2. Install Ubuntu from Microsoft Store
3. Develop inside WSL2 (no Visual Studio needed)

But for Windows native development, Build Tools are required.
