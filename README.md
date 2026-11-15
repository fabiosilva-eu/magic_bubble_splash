# Magic Bubble Splash

A WebXR VR & desktop arcade game built with **Three.js**, **WebXR**, **TypeScript**, and **Vite**. Grab your water pistols in a magical meadow and pop rising iridescent soap bubbles before time runs out!

## Gameplay & Features

- **Ballistic Water Pistols**: Dual-wield 3D water pistols in VR (or aim a camera-mounted pistol on desktop) that spray continuous arcs of water droplets with gravity and splash particles.
- **Three Bubble Tiers**:
  - **Standard Bubbles** — `10 pts`
  - **Small Fast Bubbles** — `20 pts`
  - **Golden Bubbles** — `30 pts`
- **Two Game Modes**:
  - **Timed Mode** — 60-second sprint to score as high as possible.
  - **Milestone Mode** — Starts with 45 seconds; every `100` points awards `+50` bonus points and `+12` bonus seconds, while bubbles gradually rise faster and spawn in smaller numbers over time.
- **3D Spatial UI**: Interactive in-world Start Menu, Game Over summary, and in-game HUD/Menu button.
- **Procedural Audio**: Synthesized Web Audio sound effects for water squirts, bubble pops, menu clicks, milestones, and game over.
- **VR & Desktop Support**: Full WebXR session support via Three.js `VRButton` plus a mouse-controlled desktop mode for quick play and testing.

## Controls

- **VR Headset & Controllers**:
  - **Trigger (`selectstart` / hold)**: Select 3D menu buttons or spray water.
  - **Thumbstick**: Smooth locomotion around the meadow.
- **Desktop**:
  - **Mouse Move**: Aim the water pistol and highlight 3D menu buttons.
  - **Left Click / Hold**: Select menu buttons or spray water.

## Getting Started

```bash
npm install
npm run dev
```

Open the local or network URL shown by Vite (e.g. `https://localhost:5173` or `https://<your-lan-ip>:5173`) in your browser.

> **Note on HTTPS:** WebXR requires a secure context (`https://`) on non-`localhost` addresses. `vite.config.ts` uses `@vitejs/plugin-basic-ssl` and `host: true` so the dev server is exposed on your local network over HTTPS. Accept the self-signed certificate warning in your headset or desktop browser on first visit.

## Build & Preview

```bash
npm run build
npm run preview
```

## Testing VR

- **Desktop without a headset**: Install the **Immersive Web Emulator** browser extension (Chrome/Edge) to simulate a VR headset and controllers.
- **Standalone headset (e.g., Meta Quest) on the same Wi-Fi**:
  - Run `npm run dev` and open the `https://<your-lan-ip>:5173` Network URL printed by Vite in the headset browser, then accept the self-signed certificate prompt.
  - Alternatively, over USB with ADB: `adb reverse tcp:5173 tcp:5173` and open `https://localhost:5173`.

## License

Licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0-or-later)](LICENSE).

