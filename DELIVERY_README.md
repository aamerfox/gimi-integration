# Gimi Tracking Platform – Developer Delivery Guide

This document serves as the comprehensive delivery documentation for the **Gimi Tracking Platform**. The workspace contains two distinct, fully-featured applications built on modern technologies, designed for different user experiences (B2B Web vs. B2C Native Mobile).

---

## 🏗 System Architecture Overview

The system is split into two primary frontend layers communicating with the Gimi APIs (TrackSolid Backend):

1. **`gimi-tracking-app` (Web Platform)**
   - **Type**: Single Page Application (SPA).
   - **Tech Stack**: React 19, Vite, TailwindCSS (v4), Zustand, React Router, React Leaflet, Lucide Icons.
   - **Purpose**: A comprehensive web-based tracking dashboard meant for fleet managers or desktop users. It also includes Capacitor packages if wrapping the web view into a hybrid container is desired in the future.

2. **`gimi-mobile` (Native Mobile App)**
   - **Type**: Native Cross-Platform Application.
   - **Tech Stack**: React Native (0.81), Expo (SDK 54), Expo Router, Zustand, React Native Maps, Leaflet (WebViews for advanced polyline rendering), `@expo/vector-icons` (Feather).
   - **Purpose**: A highly performant, B2C native tracking application optimized for iOS and Android devices, featuring RTL support, dark/light modes, native bottom sheet panels, and push-like notification polling.

> [!NOTE]
> Both applications utilize identical authentication bridging and API service clients (`services/gimi.ts`) to maintain feature parity when communicating with the TrackSolid API.

---

## 🛠 Prerequisites

Before running any of the applications locally, ensure the developer environment has the following installed:
- **Node.js**: v18.x or v20.x (LTS recommended)
- **NPM**: v10+ (Standard npm comes with Node)
- **Git**
- *(Mobile Only)* **Expo Go / Development Build**: For running the mobile app on a physical device or emulator.
- *(Mobile Only)* **Android Studio / Xcode**: If compiling native binaries locally.

---

## 🖥 1. Running the Web Platform (`gimi-tracking-app`)

The web platform provides the central fleet management interface.

### Installation
Open your terminal, navigate to the web directory, and install dependencies:
```bash
cd gimi-tracking-app
npm install
```

### Development Server
Run the Vite development server with Hot Module Replacement (HMR):
```bash
npm run dev
```
> [!TIP]
> This will start the server typically on `http://localhost:5173`. Open this URL in your web browser.

### Production Build
To create an optimized production bundle:
```bash
npm run build
```
The compiled static assets will be output to the `/dist` directory. You can preview the production build locally using:
```bash
npm run preview
```

### Hybrid Mobile (Capacitor)
If you wish to run the **Web App** as a hybrid mobile application:
```bash
npm run build
npx cap sync android
npx cap open android
```

---

## 📱 2. Running the Native Mobile App (`gimi-mobile`)

The `gimi-mobile` project is a fully native application built with Expo.

### Installation
Navigate to the mobile directory and install dependencies:
```bash
cd gimi-mobile
npm install
```

### Start the Expo Development Server
To launch the Metro Bundler and open the Expo development terminal:
```bash
npm start
# or
npx expo start
```
*A QR code will appear in the terminal. You can scan this with the **Expo Go** app on your physical iPhone or Android device to preview the app instantly.*

### Running on Emulators (Local Compilation)
If you prefer running on a local Android Emulator or iOS Simulator:
- **Android Emulator**: Ensure Android Studio is running a virtual device, then press `a` in the Expo terminal, or run:
  ```bash
  npm run android
  ```
- **iOS Simulator** (Mac only): Ensure Xcode is installed, then press `i` in the Expo terminal, or run:
  ```bash
  npm run ios
  ```

### Building the APK / IPA (Production)
You can utilize Expo Application Services (EAS) to build the standalone applications in the cloud, or compile locally.
- **Configure EAS**: `npx eas build:configure`
- **Build Android APK**:
  ```bash
  npx eas build -p android --profile preview
  ```
- **Local Prebuild** (for native code access):
  ```bash
  npx expo prebuild
  ```

---

## 🎨 UI & Design Implementation Details

To ensure a highly professional "premium" look and feel across both platforms, specific design systems have been rigorously enforced:

- **Web Icons:** We utilize `lucide-react` across the web application for pixel-perfect, scalable SVG paths.
- **Mobile Icons:** We have sanitized the mobile interface from all standard Unicode Emojis and completely migrated to `Feather` vector icons (via `@expo/vector-icons`) to exactly match the Web's Lucide aesthetic.
- **Styling Paradigm:**
  - *Web:* Fully styled via Tailwind CSS (`index.css` global directives).
  - *Mobile:* Themed via a structured Constants map (`constants/Colors.ts`) utilizing a robust `StyleSheet.create` paradigm that automatically toggles between Dark and Light mode.
- **RTL / Internationalization:** Both applications support robust runtime localized translation (`react-i18next`).

> [!IMPORTANT]
> When developers add new UI elements or screens in the future, they MUST use the respective vector icon families (`lucide-react` for Web, `Feather` for Mobile) rather than emojis to maintain visual professionalism.
