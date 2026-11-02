import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axe from 'axe-core'
import { LidarPage } from '@/pages/Lidar/LidarPage'
import { useConnectionStore } from '@/store/connectionStore'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { lidarManager } from '@/services/lidar/lidarManager'
import { rosbridgeClient } from '@/services/rosbridgeClient'

describe('LidarPage — UI, State & Accessibility', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      status: 'connected',
    })
    useRosDiscoveryStore.getState().clear()
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

  it('handles clicking Start Stream button and starts the stream', async () => {
    useRosDiscoveryStore.getState().applyDiscoveryResults(
      {
        topics: ['/scan'],
        types: ['sensor_msgs/LaserScan'],
      },
      ['/rplidarNode'],
      []
    )

    let capturedCallback: ((msg: unknown) => void) | null = null
    const subscribeSpy = vi
      .spyOn(rosbridgeClient, 'subscribeLaserScan')
      .mockImplementation(async (_topic, onMessage) => {
        capturedCallback = onMessage
        return () => {
          capturedCallback = null
        }
      })

    const startSpy = vi.spyOn(lidarManager, 'start')

    render(
      <MemoryRouter>
        <LidarPage />
      </MemoryRouter>
    )

    const startButton = screen.getByRole('button', { name: /Start Stream/i })
    expect(startButton).toBeInTheDocument()
    expect(startButton).not.toBeDisabled()

    await act(async () => {
      fireEvent.click(startButton)
    })

    expect(startSpy).toHaveBeenCalledWith('LidarPage', '/scan', 100)
    expect(subscribeSpy).toHaveBeenCalledWith('/scan', expect.any(Function), 100, 'LidarService')
    expect(lidarManager.getState()).toBe('waiting')

    act(() => {
      if (capturedCallback) {
        capturedCallback({
          header: { seq: 1, stamp: { secs: 1700000000, nsecs: 0 }, frame_id: 'laser' },
          angle_min: -3.14,
          angle_max: 3.14,
          angle_increment: 0.017,
          time_increment: 0,
          scan_time: 0.1,
          range_min: 0.15,
          range_max: 12.0,
          ranges: [1.0, 2.0, 3.0],
        })
      }
    })

    expect(lidarManager.getState()).toBe('streaming')
    expect(screen.getByRole('button', { name: /Stop Stream/i })).toBeInTheDocument()
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
