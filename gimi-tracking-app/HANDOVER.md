# SaudiEx Tracking App - Handover Documentation

## 1. Project Overview
The SaudiEx Tracking App is a Vite-based React application providing real-time GPS tracking, historical data playback, geofencing, and alert management. It integrates seamlessly with the **TrackSolid Pro IoT API** to fetch live telemetry and device data.

> [!NOTE]
> For information regarding the status and setup of the mobile (Expo) application, please see [MOBILE_STATUS.md](./MOBILE_STATUS.md).

## 2. API Integration (TrackSolid Pro)
The application communicates with the TrackSolid Pro platform using a secure, signed request mechanism:
- **Authentication**: Uses MD5-based HMAC signatures for all API calls (`app_key`, `timestamp`, `sign`).
- **Data Source**: Fetches real-time location, historical tracks, and alert notifications.
- **Proxy Layer**: API traffic is routed through a Cloud Run endpoint to manage CORS and ensure secure token rotation.
- **Endpoints**: Integrated with core Jimi/TrackSolid methods such as `jimi.device.location.get`, `jimi.device.track.list`, and `jimi.device.alarm.list`.

## 2. Key Features
- **Live Tracking**: Real-time position monitoring with auto-refresh.
- **History Playback**: Detailed movement history with adjustable playback speeds and date ranges.
- **Geofence Management**: Dynamic creation, editing, and toggling of circular geofences.
- **Alert System**: Customizable alert rules (In/Out/Vibration) with modal-based configuration.
- **Secure Sharing**: Temporary link generation for sharing live device locations with external users.
- **Responsive Design**: Optimized for Desktop, Tablet, and Mobile viewports.

## 3. Technical Remediation
The project has undergone a complete code audit and remediation:
- **Zero Errors**: Resolved all TypeScript compilation errors and ESLint warnings.
- **Type Safety**: Implemented robust type casting for API responses and state management.
- **Clean Build**: `npm run build` and `npx eslint .` pass 100%.

## 4. Testing Suite (Playwright)
The application is now covered by an extensive E2E testing suite (57 tests).

### Coverage Summary:
- **Alerts**: Rule lifecycle and filtering.
- **Geofences**: Panel state and CRUD operations.
- **History**: Date picker integration and playback.
- **Share**: Link generation and secure view access.
- **Responsive**: Mobile-specific interaction and auth-gate verification.

### Running Tests:
```bash
# Run all tests
npm test

# Run tests with visual UI
npx playwright test --ui

# View latest report
npx playwright show-report
```

## 5. Deployment & Maintenance
- **Build Production**: `npm run build` - results in the `dist/` folder.
- **Docker**: A `Dockerfile` is provided for containerized deployment (e.g., Cloud Run).
- **Environment**: Ensure `VITE_API_URL` or proxy settings in `vite.config.ts` are configured for your target environment.

---
**Delivered by Antigravity AI on 2026-03-27.**
