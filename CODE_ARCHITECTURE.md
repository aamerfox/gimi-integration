# Internal Code Architecture & Documentation

This document provides a deep dive into the internal codebase structure, state management, and core services for both the **Gimi Web Application** and **Gimi Mobile Application**. It is designed to onboard developers quickly by explaining *how* the applications function under the hood.

---

## 1. Project Structures Overview

Both the Web and Mobile projects share a conceptually identical architectural pattern, despite utilizing different UI frameworks (React vs. React Native).

### Web (`gimi-tracking-app/`)
Uses standard Vite + React directory structures:
- `src/components/`: Reusable, atomic UI components (e.g., `DevicePanel`, `B2CDashboardOverlay`).
- `src/pages/`: Full-screen route handlers (e.g., `Dashboard`, `Settings`, `Geofences`).
- `src/layouts/`: Structural wrappers that manage fixed UI elements (Sidebar, Navbar) around nested routes.
- `src/store/`: Zustand state management slices.
- `src/services/`: API bridging and HTTP clients.
- `src/locales/`: i18n translation dictionaries (`en.json`, `ar.json`).

### Mobile (`gimi-mobile/`)
Uses Expo Router (File-Based Routing):
- `app/`: Defines the navigation architecture.
  - `app/login.tsx`: Root authentication screen.
  - `app/(tabs)/`: Contains the persistent bottom tab navigation files (`_layout.tsx`, `index.tsx`, `history.tsx`, etc.).
- `store/`: Zustand state definitions (synced automatically using `persist` middleware).
- `services/`: Native tracking and API integration utilities.
- `constants/Colors.ts`: Theme configurations (Dark/Light).

---

## 2. Global State Management (Zustand)

Instead of complex Redux boilerplates, both applications use **Zustand** for lightweight, reactive state. The states are generally divided per domain and often utilize localized persistence (Local Storage for Web, AsyncStorage for Mobile).

- **`useAuthStore`**: Manages the `accessToken`, `refreshToken`, and user identity. Crucially, it manages the persistent login session by holding the token state across app reloads.
- **`useDeviceStore`**: Caches the live fleet/device list (`Device[]`), handling currently selected devices for tracking and overlay interactions.
- **`useThemeStore`**: Manages the UI theme state (`light` or `dark`). In mobile, it strictly maps to the `Colors.ts` constants inject mechanism.
- **`useGeofenceStore`**: Caches both local offline geofences and synced cloud geofences to reduce API calls and maintain fast map interactions.

---

## 3. Core API Bridge (`services/gimi.ts`)

This is the most critical internal service. The `gimiService` class orchestrates all HTTP communications with the TrackSolid APIs.

### Key Responsibilities:
1. **Authentication Interception**: Standardizing login payloads and attaching the `accessToken` to subsequent requests. Note: Session persistence logic ensures the token isn't blindly wiped upon manual expiry checks unless specifically logged out (`login.tsx` / `Settings.tsx`).
2. **Telemetry Ingestion**: Methods like `getTracking` and `getDevices` normalize external payload schemas into standard TypeScript interfaces (e.g., merging `status` and `speed` metrics).
3. **Hardware Dispatch**: Methods to execute FOTA (Firmware Over-The-Air) or Relay cutoff commands directly through API polling architectures.

> [!WARNING]
> Developers must ensure that all new API methods inside `gimi.ts` appropriately wrap network errors inside standard try/catch blocks, throwing user-friendly string messages back to the UI.

---

## 4. Map & Rendering Engine (Leaflet)

Rendering real-time vehicle movement and massive polyline histories requires performance optimization.

- **Web Context (`B2CDashboardOverlay`, `react-leaflet`)**: 
  Direct rendering of map tiles and vector layers. Developers can use raw DOM manipulation when required for high-frequency GPS updates.
- **Mobile Context (`react-native-webview` with raw HTML injection)**:
  Because `react-native-maps` heavily tanks performance on long polyline tracks (History), the mobile app injects a lightweight, raw vanilla Leaflet HTML map natively via a WebView (`app/(tabs)/history.tsx` and `app/(tabs)/geofences.tsx`).
  - *Data Passing*: React Native sends JSON strings via `postMessage()`.
  - *Data Receiving*: The `window.addEventListener('message')` inside the generated HTML immediately shifts map bounds and markers.

---

## 5. UI Components & Theming Strategies

### Web Styling (Tailwind v4)
All visual logic inside `gimi-tracking-app` components strictly uses standard `className` strings with Tailwind conventions. Dynamic toggling uses conditional templating (e.g. `clsx` or ternary operators).
- **Icons**: Always import from `lucide-react`.

### Mobile Styling (`StyleSheet.create` Injection)
React Native doesn't use Tailwind in this project. The architecture uses a unique Theme Injection pattern:
1. Extract the current theme: `const { theme } = useThemeStore();`
2. Extract the color map: `const C = COLORS[theme];`
3. Pass colors into a dynamic stylesheet generator: `const s = styles(C);`
```javascript
// Example of the Mobile Theming Pattern
const styles = (C: any) => StyleSheet.create({
    container: { backgroundColor: C.bgPrimary },
    text: { color: C.textPrimary }
});
```
- **Icons**: Always import from `@expo/vector-icons` (specifically the `Feather` library to ensure 1:1 parity with Web Lucide icons).

---

## 6. Time & Translation (i18n)

- **Localization (`react-i18next`)**: Text strings are never hardcoded. They are wrapped in `t('key')` from the translation files (`locales/`). RTL layout shifts automatically trigger via Tailwind (`rtl:space-x-reverse`) on Web, and Flexbox `flexDirection: 'row-reverse'` on Mobile when Arabic config is active.
- **Time Utilities (`utils/time.ts`)**: Timezone standardization ensures that the raw timestamp string returned by TrackSolid (UTC+8 or direct UTC) is normalized correctly across local device time zones using `date-fns`.
