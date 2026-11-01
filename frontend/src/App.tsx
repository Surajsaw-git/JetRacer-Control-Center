import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import RootLayout from '@/layouts/RootLayout'
import { SkeletonCard } from '@/components/common/SkeletonCard'

// Lazy-loaded routes for optimal code-splitting and bundle performance
const DashboardPage = lazy(() => import('@/pages/Dashboard'))
const ControlPage = lazy(() => import('@/pages/Control'))
const CameraPage = lazy(() => import('@/pages/Camera'))
const LidarPage = lazy(() => import('@/pages/Lidar'))
const MappingPage = lazy(() => import('@/pages/Mapping'))
const NavigationPage = lazy(() => import('@/pages/Navigation'))
const SystemPage = lazy(() => import('@/pages/System'))
const SettingsPage = lazy(() => import('@/pages/Settings'))
const HistoryPage = lazy(() => import('@/pages/History'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function PageFallback() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard lines={6} />
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route
            index
            element={
              <Suspense fallback={<PageFallback />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="control"
            element={
              <Suspense fallback={<PageFallback />}>
                <ControlPage />
              </Suspense>
            }
          />
          <Route
            path="camera"
            element={
              <Suspense fallback={<PageFallback />}>
                <CameraPage />
              </Suspense>
            }
          />
          <Route
            path="lidar"
            element={
              <Suspense fallback={<PageFallback />}>
                <LidarPage />
              </Suspense>
            }
          />
          <Route
            path="mapping"
            element={
              <Suspense fallback={<PageFallback />}>
                <MappingPage />
              </Suspense>
            }
          />
          <Route
            path="navigation"
            element={
              <Suspense fallback={<PageFallback />}>
                <NavigationPage />
              </Suspense>
            }
          />
          <Route
            path="system"
            element={
              <Suspense fallback={<PageFallback />}>
                <SystemPage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<PageFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route
            path="history"
            element={
              <Suspense fallback={<PageFallback />}>
                <HistoryPage />
              </Suspense>
            }
          />
          <Route
            path="404"
            element={
              <Suspense fallback={<PageFallback />}>
                <NotFoundPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
