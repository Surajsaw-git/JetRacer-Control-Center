/**
 * Application environment configuration service.
 *
 * NOTE: The robot IP address is not hardcoded. In Phase 3 (IP connection),
 * users can configure and persist the target Jetson host IP directly in the app.
 */

export interface AppConfig {
  apiBaseUrl: string
  rosbridgeUrl: string
}

export const appConfig: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  rosbridgeUrl: import.meta.env.VITE_ROSBRIDGE_URL || 'ws://localhost:9090',
}
