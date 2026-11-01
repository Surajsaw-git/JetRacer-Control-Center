import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import RootLayout from '@/layouts/RootLayout'
import DashboardPage from '@/pages/Dashboard'
import CameraPage from '@/pages/Camera'
import LidarPage from '@/pages/Lidar'
import MappingPage from '@/pages/Mapping'
import NavigationPage from '@/pages/Navigation'
import ControlPage from '@/pages/Control'
import SystemPage from '@/pages/System'
import SettingsPage from '@/pages/Settings'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="camera" element={<CameraPage />} />
          <Route path="lidar" element={<LidarPage />} />
          <Route path="mapping" element={<MappingPage />} />
          <Route path="navigation" element={<NavigationPage />} />
          <Route path="control" element={<ControlPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
