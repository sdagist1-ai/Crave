# Crave Future Enhancements

## 1. Native iOS Face ID / Touch ID Integration
The following steps outline the process for adding biometric authentication to Crave when compiled for iOS via Capacitor.

### Requirements:
- The app must be compiled and tested on a physical iOS device via TestFlight or Xcode (biometrics cannot be accurately tested in the standard web browser).
- Capacitor Community Biometric Auth Plugin.

### Implementation Steps:
1. **Install the Plugin:** Run `npm install @capacitor-community/device-passcode` (or `@aparajita/capacitor-biometric-auth`) and sync iOS via `npx cap sync ios`.
2. **Update Apple Privacy Manifest (`Info.plist`):** Insert the `NSFaceIDUsageDescription` key explaining the purpose to the user (e.g., "Crave uses Face ID to securely unlock your private restaurant lists"). **CRITICAL:** Missing this step will cause immediate app crashes upon Apple Review.
3. **Build the Lock Screen Component:** Create a full-screen, un-dismissible React component that mounts at the top of the App tree.
4. **Wire the Logic:** 
   - On initial load, the app checks if the device supports biometrics (`BiometricAuth.isAvailable()`).
   - The lock screen instantly triggers `BiometricAuth.authenticate()`.
   - On success, the lock screen unmounts and grants access to the main dashboard.
   - On failure, provide a "Use Passcode" fallback button.
