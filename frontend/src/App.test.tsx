import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { DashboardPage } from './pages/Dashboard'
import { CameraPage } from './pages/Camera'
import { LidarPage } from './pages/Lidar'
import { MappingPage } from './pages/Mapping'
import { NavigationPage } from './pages/Navigation'
import { ControlPage } from './pages/Control'
import { SystemPage } from './pages/System'
import { SettingsPage } from './pages/Settings'

describe('App Smoke Tests', () => {
  it('renders without crashing and displays the default Dashboard placeholder', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'JetRacer Control' })).toBeInTheDocument()
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getByText('Not implemented — planned for Phase 1')).toBeInTheDocument()
  })

  it('navigates to each route and displays the corresponding placeholder', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Control
    const controlLinks = screen.getAllByRole('link', { name: /Control/i })
    await user.click(controlLinks[0])
    expect(await screen.findByText('Not implemented — planned for Phase 8')).toBeInTheDocument()

    // Camera
    const cameraLinks = screen.getAllByRole('link', { name: /Camera/i })
    await user.click(cameraLinks[0])
    expect(await screen.findByText('Not implemented — planned for Phase 5')).toBeInTheDocument()

    // LiDAR
    const lidarLinks = screen.getAllByRole('link', { name: /LiDAR/i })
    await user.click(lidarLinks[0])
    expect(await screen.findByText('Not implemented — planned for Phase 6')).toBeInTheDocument()

    // Mapping
    const mappingLinks = screen.getAllByRole('link', { name: /Mapping/i })
    await user.click(mappingLinks[0])
    expect(await screen.findByText('Not implemented — planned for Phase 7')).toBeInTheDocument()

    // Navigation
    const navLinks = screen.getAllByRole('link', { name: /Navigation/i })
    await user.click(navLinks[0])
    expect(await screen.findByText('Not implemented — planned for Phase 9')).toBeInTheDocument()

    // System
    const systemLinks = screen.getAllByRole('link', { name: /System/i })
    await user.click(systemLinks[0])
    expect(await screen.findByText('Not implemented — planned for Phase 10')).toBeInTheDocument()

    // Settings
    const settingsLinks = screen.getAllByRole('link', { name: /Settings/i })
    await user.click(settingsLinks[0])
    expect(await screen.findByText('Not implemented — planned for Phase 3')).toBeInTheDocument()

    // Back to Dashboard
    const dashboardLinks = screen.getAllByRole('link', { name: /Dashboard/i })
    await user.click(dashboardLinks[0])
    expect(await screen.findByText('Not implemented — planned for Phase 1')).toBeInTheDocument()
  })

  it('renders all 8 page placeholder components directly', () => {
    const pages = [
      { Component: DashboardPage, text: 'Not implemented — planned for Phase 1' },
      { Component: ControlPage, text: 'Not implemented — planned for Phase 8' },
      { Component: CameraPage, text: 'Not implemented — planned for Phase 5' },
      { Component: LidarPage, text: 'Not implemented — planned for Phase 6' },
      { Component: MappingPage, text: 'Not implemented — planned for Phase 7' },
      { Component: NavigationPage, text: 'Not implemented — planned for Phase 9' },
      { Component: SystemPage, text: 'Not implemented — planned for Phase 10' },
      { Component: SettingsPage, text: 'Not implemented — planned for Phase 3' },
    ]

    for (const { Component, text } of pages) {
      const { unmount } = render(<Component />)
      expect(screen.getByText(text)).toBeInTheDocument()
      unmount()
    }
  })
})
