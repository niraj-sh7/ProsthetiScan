# ProsthetiScan (Expo App)

ProsthetiScan is an Expo/React Native app for low‑cost prosthetic measurement and quick test‑fit model generation. It runs entirely on‑device. No backend/API is required.

Key features
- Camera capture with alignment overlay
- Dual high‑performance calipers (Calibrate + Limb)
- 60 fps drags via Reanimated + Gesture Handler
- Axis‑lock (Free/Horizontal/Vertical) with ±8° snap
- Pinch‑to‑scale center grip; tap‑to‑place for accessibility
- Haptics on snap/placement for instant feedback
- Live width estimate; multi‑shot averaging for robustness
- One‑tap STL generation for 3D printing (test socket/cuff)
- In‑app 3D preview (Expo GL + Three.js)

## Prerequisites
- Node 18+ and npm
- Expo CLI (using 
px expo ... is fine)
- Expo Go (development) or a Dev Build if you need native modules outside Expo Go

## Install & Run (development)
`ash
# from this folder
npm install
npx expo start -c
`
- Press i / a to open on iOS/Android (or scan the QR with Expo Go).
- If you see a gesture warning, fully reload the bundler after installing deps.

## Using the App
1) Home → Capture: take a photo of the limb with a household calibrator visible (coin/card/battery).
2) Review:
   - Choose the calibrator type at the top.
   - Calibrate (BLUE): drag endpoints across the calibrator; use axis lock for cleaner alignment; pinch center grip to refine span.
   - Limb (GREEN): drag endpoints across the limb width at the desired location.
   - Switch lock mode: Free / Horizontal / Vertical. Free snaps to H/V when within ±8°.
   - Tap near center to move the whole caliper; tap elsewhere to place the nearest endpoint.
   - Add up to 3 shots; then Average and Continue.
3) Results: view averaged width and simple recommendation.
4) Model: generate an STL for test fit (ring/cuff presets), share the file or export a ZIP bundle.
5) Preview 3D: spin and inspect the generated shell.

## Printing Guidance (test fit)
- Units: millimeters
- Suggested: PETG, 0.2–0.28 mm layers, 3 perimeters, infill 0%, brim for adhesion
- STL is a simplified test shell. Not a medical device.

## No Backend/API
- The current build performs measurement locally and does not call any server.
- Any API_URL entries in app.json are ignored by the app logic.

## Native Modules used
- react‑native‑gesture‑handler, react‑native‑reanimated, react‑native‑worklets
- expo‑gl, three, three‑stdlib
- expo‑haptics, expo‑file‑system (legacy API)

If you create a Dev Build, ensure these are included. In Expo Go, they work out of the box.

## Troubleshooting
- Blank 3D preview
  - Stop Metro and run 
px expo start -c.
  - Ensure expo-gl, 	hree, and 	hree-stdlib are installed.
- Gesture errors
  - App is wrapped with GestureHandlerRootView. If you changed the root, wrap it again.
  - Clear cache after adding Reanimated plugin in abel.config.js.
- Reanimated warnings
  - Avoid reading sharedValue .value in React render; the app uses animatedProps for labels.
- iOS Dev Build
  - Rebuild if native modules were added after the last build.

## Scripts
- 
pm start: start development server
- 
pm run ios: start on iOS simulator (Expo)
- 
pm run android: start on Android emulator (Expo)
- 
pm run web: web preview (camera disabled)

## License / Safety
- Prototype for research/education. Not a medical device.
