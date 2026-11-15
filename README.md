# WebXR VR Game Scaffold

A browser-based VR game starter built with **Three.js**, **WebXR**, **TypeScript**, and **Vite**.

## Features

- WebXR session entry via Three.js `VRButton`
- Dual VR controller support with 3D controller models (`XRControllerModelFactory`) and laser pointer rays
- Trigger (`selectstart`) target shooting with hover highlights and score tracking
- Thumbstick locomotion in VR
- Desktop fallback (mouse hover + click) for quick testing without a headset

## Getting Started

```bash
npm install
npm run dev
```

Open the local or network URL shown by Vite (e.g. `https://localhost:5173` or `https://<your-lan-ip>:5173`) in your browser.

> **Note on HTTPS:** WebXR requires a secure context (`https://`) on non-`localhost` addresses. `vite.config.ts` uses `@vitejs/plugin-basic-ssl` and `host: true` so the dev server is exposed on your local network over HTTPS. Accept the self-signed certificate warning in your headset or desktop browser on first visit.

## Testing VR

- **Desktop without a headset**: Install the **Immersive Web Emulator** browser extension (Chrome/Edge) to simulate a VR headset and controllers.
- **Standalone headset (e.g., Meta Quest) on the same Wi-Fi**:
  - Run `npm run dev` and open the `https://<your-lan-ip>:5173` Network URL printed by Vite in the headset browser, then accept the self-signed certificate prompt.
  - Alternatively, over USB with ADB: `adb reverse tcp:5173 tcp:5173` and open `https://localhost:5173`.
