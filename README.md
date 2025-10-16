# ProsthetiScan (Expo App)

ProsthetiScan is an Expo/React Native app for low-cost prosthetic measurement and fast test-fit model generation. It runs entirely on-device with no backend required.

***

## Key Features

- Camera capture with alignment overlay
- Dual high-performance calipers: Calibrate (BLUE) and Limb (GREEN)
- 60 fps drags powered by Reanimated and Gesture Handler
- Axis-lock: Free, Horizontal, or Vertical, with auto-snap within ±8°
- Pinch-to-scale center grip; tap-to-place for accessibility
- Haptics for instant feedback on snap and placement
- Live width estimates and multi-shot averaging for robust results
- One-tap STL generation for instant 3D print models (test socket/cuff)
- In-app 3D preview (Expo GL and Three.js)

***

## Prerequisites

- Node 18+ and npm
- Expo CLI (`npx expo ...`)
- Expo Go (for development) or a Dev Build for native modules

***

## Install & Run

```bash
# In the project folder:
npm install
npx expo start -c
```
Press `i` or `a` to open in iOS or Android simulator, or scan the QR code in Expo Go. If gesture warnings appear, fully reload the bundler after installing dependencies.

***

## Using the App

1. Home → Capture: Take a photo of the limb with a household calibrator in frame (coin, card, battery, etc).
2. Review:
    - Select the calibrator type at the top.
    - Calibrate (BLUE): Drag endpoints across the calibrator, use axis lock for alignment, pinch center grip to refine.
    - Limb (GREEN): Drag endpoints for limb width at the desired location.
    - Switch lock mode: Free, Horizontal, or Vertical. Free mode auto-snaps angles within ±8°.
    - Tap near the center to move the whole caliper; tap elsewhere to place the nearest endpoint.
    - Add up to 3 shots, then average and continue.
3. Results: View averaged width and receive a simple recommendation.
4. Model: Generate an STL for test fit (ring/cuff presets), then share or export as a ZIP file.
5. Preview 3D: Spin and inspect the generated model.

***

## Printing Guidance (test fit)

- Units are in millimeters.
- Suggested: PETG, 0.2–0.28 mm layers, 3 perimeters, 0% infill, use brim for adhesion.
- The STL is a simplified test shell and is not a medical device.

***

## No Backend/API

- All measurement is done locally; no server required.
- Any API_URL settings in app.json are ignored.

***

## Native Modules Used

- react-native-gesture-handler, react-native-reanimated, react-native-worklets
- expo-gl, three, three-stdlib
- expo-haptics, expo-file-system (legacy)

For a Dev Build, ensure these modules are included. In Expo Go, everything works out of the box.

***

## Troubleshooting

Blank 3D preview:  
- Stop Metro and run `npx expo start -c`.
- Make sure expo-gl, three, and three-stdlib are installed.

Gesture errors:  
- Confirm the app is wrapped in GestureHandlerRootView.
- Rewrap if you changed the root component.
- Clear cache after adding the Reanimated plugin to babel.config.js.

Reanimated warnings:  
- Avoid reading `.value` from sharedValue in React render; use animatedProps for visual labels.

iOS Dev Build:  
- Rebuild the app if new native modules were added since your last build.

***

## Scripts

- `npm start`: Start the development server
- `npm run ios`: Launch iOS simulator (Expo)
- `npm run android`: Launch Android emulator (Expo)
- `npm run web`: Preview on web (camera disabled)

***

## License / Safety

ProsthetiScan is a prototype for research and education. It is not a medical device.
