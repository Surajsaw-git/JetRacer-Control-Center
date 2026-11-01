import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.surajsaw.jetracer',
  appName: 'JetRacer Control Center',
  webDir: 'dist',
  server: {
    // Android blocks cleartext (HTTP / WS) traffic by default starting from Android 9 (API 28).
    // Enabling cleartext: true is required for communication over local Wi-Fi with the Jetson robot's
    // FastAPI backend (http://<JETSON_IP>:8000) and rosbridge websocket (ws://<JETSON_IP>:9090).
    // SECURITY NOTE: Complete HTTPS/WSS and token authentication hardening is scheduled for Phase 13.
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
