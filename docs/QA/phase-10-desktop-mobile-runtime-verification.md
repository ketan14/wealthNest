# Phase 10 QA Test Plan & Verification Specification: Cross-Platform Desktop & Mobile Runtime (Tauri 2 Native Packaging & OS Sandboxing)

> **Document Status**: **DRAFT / PENDING IMPLEMENTATION**  
> **Phase**: 10 — Cross-Platform Desktop & Mobile Runtime  
> **Prerequisites**: Phase 9.1 (Persistence Decoupling & SQLite Engine) and Phase 9.2 (Mobile Responsive UI & Touch Ergonomics)  
> **Target Delivery Platforms**: Windows, macOS, Linux, Android, iOS  
> **Core Architectural Stack**: Tauri 2, Rust, Vite, React 18, `@tauri-apps/plugin-sql`, Clean Architecture  

---

## 1. Executive Summary & Multi-Platform Quality Gates

Phase 10 takes the decoupled, touch-ergonomic WealthNest application developed in Phase 9 and packages it into native desktop and mobile binaries using **Tauri 2**.

### 1.1 Strict Platform Verification Standards
1. **Independent Verification Tracks**:
   - Responsive web emulation in a browser **does not prove** a functioning Tauri binary.
   - Each platform (Windows, macOS, Linux, Android, iOS) must be compiled, packaged, installed, launched, and verified independently.
   - Untested platforms remain strictly designated as **Unverified / In Progress** until executable build artifacts and runtime logs are captured.
2. **Local Sandbox Persistence**:
   - The database file (`wealthnest_v1.db`) is stored in the OS-managed private application data directory (`appDataDir()`).
   - All financial records survive application restarts, background task freezing, and OS reboots with zero network connection.
3. **Native Capability Plugins**:
   - **Filesystem & Dialogs**: Native OS save/open dialogs via `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` replace browser Blob URLs.
   - **Biometric Security**: Native FaceID / Fingerprint authentication via `@tauri-apps/plugin-biometric` for offline personal privacy.
   - **Deep Linking**: Native URL protocol handling (`wealthnest://`) via `@tauri-apps/plugin-deep-link` for authentication callbacks.

---

## 2. Independent Platform Readiness Tracks

Platform support is verified across four distinct compilation and runtime tracks:

```
[ Track 1: Linux Desktop Runtime   ]  --->  Verified via .deb / AppImage on Ubuntu/Debian
[ Track 2: Windows Desktop Runtime ]  --->  Verified via .msi / .exe on Windows 10/11
[ Track 3: macOS Desktop Runtime   ]  --->  Verified via .dmg / .app on macOS Apple Silicon & Intel
[ Track 4: Mobile Runtime (Android/iOS) ]  --->  Verified via APK on Android 14+ and Simulator on iOS 17+
```

| Platform Track | Target Binary | Native Engine | Offline Sandbox Path | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Track 1: Linux Desktop** | `.deb` / AppImage | WebKitGTK + SQLite | `~/.local/share/wealthnest/` | ⏳ Pending Build |
| **Track 2: Windows Desktop** | `.msi` / `.exe` | WebView2 + SQLite | `%APPDATA%\wealthnest\` | ⏳ Pending Build |
| **Track 3: macOS Desktop** | `.dmg` / `.app` | WKWebView + SQLite | `~/Library/Application Support/wealthnest/` | ⏳ Pending Build |
| **Track 4A: Android Mobile** | `.apk` / `.aab` | Android System WebView | `/data/user/0/in.wealthnest.app/files/` | ⏳ Pending Build |
| **Track 4B: iOS Mobile** | `.ipa` | WebKit WebView | `NSApplicationSupportDirectory` | ⏳ Pending Build |

---

## 3. Platform-Specific Architectural Invariants

### 3.1 Desktop Window Management & Chrome
* **Windows & Linux**: Custom frameless window with drag region:
  ```html
  <div data-tauri-drag-region className="h-8 flex items-center justify-between bg-card">
  ```
  Includes native minimize, maximize/restore, and close buttons.
* **macOS**: Native traffic-light controls with overlay titlebar:
  ```json
  { "titleBarStyle": "Overlay", "hiddenTitle": true }
  ```

### 3.2 Native File Export & Import Workflows
* **Backup Export**:
  1. User clicks "Complete JSON Backup".
  2. Runtime invokes `@tauri-apps/plugin-dialog.save({ defaultPath: 'wealthnest_portfolio_backup.json' })`.
  3. Writes JSON payload directly to the selected disk path via `@tauri-apps/plugin-fs.writeTextFile`.
* **CAS PDF Import**:
  1. Native file picker opens with file extension filters (`['pdf', 'csv']`).
  2. In-memory ArrayBuffer is passed to `PdfJsTextExtractorAdapter` with zero external network transmission.

### 3.3 Mobile Battery & Lifecycle Management
* On Android and iOS, the runtime listens to native lifecycle events:
  - **App Backgrounded**: Pauses the live market auto-polling timer (`useLiveMarketFeed`) to prevent background battery drain.
  - **App Resumed**: Checks market trading hours and resumes quotes polling if market is open.

---

## 4. Test Execution & Verification Procedures

### TC-10-01: Linux Desktop Native Build & Packaging
* **Command**: `npm run tauri build -- --bundles deb`
* **Pass Criteria**:
  - Binary `.deb` artifact compiles with zero Rust or Vite errors.
  - Package installs cleanly on Linux without missing shared library dependencies.
  - Launch application: window renders AppShell within $\le 500\text{ms}$.
  - SQLite database file `wealthnest_v1.db` created in `~/.local/share/wealthnest/`.

### TC-10-02: Offline Database Persistence Across Application Restart
* **Steps**:
  1. Launch native desktop/mobile binary in airplane mode (zero internet connection).
  2. Add new asset holding (e.g. ₹5,00,000 in SBI Mutual Fund) and a loan liability.
  3. Close and terminate the application process.
  4. Relaunch the application while remaining offline.
  5. Verify that all previously entered assets, liabilities, and calculated net worth appear instantly.

### TC-10-03: Native File Dialog Export Verification
* **Steps**:
  1. Navigate to `/settings` $\rightarrow$ Data Portability.
  2. Click "Export Full JSON Backup".
  3. Verify native OS file save dialog appears (not browser download bubble).
  4. Save file to Desktop; verify file contains valid `wealthnest-portfolio-v1` schema matching database records.

### TC-10-04: Android Mobile Installation & Sandbox Isolation
* **Command**: `npm run tauri android build`
* **Pass Criteria**:
  - Builds `.apk` artifact.
  - Installs cleanly on Android device/emulator.
  - Touch navigation bar renders above the Android gesture navigation line (`safe-area-inset-bottom`).
  - Database is protected inside app-private internal storage sandbox.

---

## 5. Verification Gate & Certification Deliverables

1. **Compilation Logs**: Clean Rust compiler (`cargo build`) and Vite asset bundling output captured and archived.
2. **Binary Artifacts**: Verified installers generated for each supported platform.
3. **Automated Smoke Tests**: Headless WebView automation confirming clean app mount and SQLite table creation.
4. **Documentation**: Platform-specific installation guides and permission requirements updated.
