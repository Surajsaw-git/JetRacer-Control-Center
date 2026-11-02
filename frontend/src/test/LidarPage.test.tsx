import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axe from 'axe-core'
import { LidarPage } from '@/pages/Lidar/LidarPage'
import { useConnectionStore } from '@/store/connectionStore'
import { lidarManager } from '@/services/lidar/lidarManager'

describe('LidarPage — UI, State & Accessibility', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      status: 'connected',
    })
  })

  afterEach(() => {
    cleanup()
    lidarManager.reset()
    vi.restoreAllMocks()
  })

  it('renders the page header and main control elements', () => {
    render(
      <MemoryRouter>
        <LidarPage />
      </MemoryRouter>
    )

    expect(screen.getByText('LiDAR Laser Scanner')).toBeInTheDocument()
    expect(screen.getAllByText(/Visual aid only/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Throttle Rate')).toBeInTheDocument()
  })

  it('displays prominent non-safety disclaimer banner', () => {
    render(
      <MemoryRouter>
        <LidarPage />
      </MemoryRouter>
    )

    const disclaimer = screen.getByText(/Visual aid only — NOT a safety or collision-avoidance system/i)
    expect(disclaimer).toBeInTheDocument()
  })

  it('shows disconnected warning banner when ROS is not connected', () => {
    useConnectionStore.setState({
      status: 'disconnected',
    })

    render(
      <MemoryRouter>
        <LidarPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/Robot Disconnected/i)).toBeInTheDocument()
  })

  it('stops stream subscription cleanly when component unmounts', () => {
    const stopSpy = vi.spyOn(lidarManager, 'stop')

    const { unmount } = render(
      <MemoryRouter>
        <LidarPage />
      </MemoryRouter>
    )

    unmount()
    expect(stopSpy).toHaveBeenCalledWith('LidarPage')
  })

  it('passes automated accessibility audit with 0 critical or serious violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <LidarPage />
      </MemoryRouter>
    )

    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    })

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )

    expect(criticalViolations).toEqual([])
  })
})
