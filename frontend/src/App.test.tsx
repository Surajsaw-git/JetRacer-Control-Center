import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import App from './App'

describe('App Shell & Navigation Gates', () => {
  beforeEach(() => {
    // Reset route history to root for clean test isolation
    window.history.pushState({}, 'Test', '/')
  })

  it('renders the application shell with E-STOP and Connection chip on the initial route', async () => {
    render(<App />)

    // Verify Shell Headers and E-Stop button
    expect(screen.getByRole('button', { name: /Emergency Stop/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Connection status/i)).toBeInTheDocument()

    // Wait for lazy loaded Dashboard
    expect(
      await screen.findByRole('heading', { level: 1, name: /Robot Dashboard/i }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it('navigates through core routes and displays their headers', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Wait for Dashboard
    expect(
      await screen.findByRole('heading', { level: 1, name: /Robot Dashboard/i }, { timeout: 4000 }),
    ).toBeInTheDocument()

    // Navigate to Control
    const controlLinks = screen.getAllByRole('link', { name: /^Control$/i })
    await user.click(controlLinks[0])
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: /Manual Teleoperation/i },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument()

    // Navigate to Camera
    const cameraLinks = screen.getAllByRole('link', { name: /^Camera$/i })
    await user.click(cameraLinks[0])
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: /Camera Streaming/i },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument()

    // Navigate to Settings
    const settingsLinks = screen.getAllByRole('link', { name: /^Settings$/i })
    await user.click(settingsLinks[0])
    expect(
      await screen.findByRole('heading', { level: 1, name: /^Settings$/i }, { timeout: 4000 }),
    ).toBeInTheDocument()

    // Navigate to History
    const historyLinks = screen.getAllByRole('link', { name: /^History$/i })
    await user.click(historyLinks[0])
    expect(
      await screen.findByRole('heading', { level: 1, name: /Event History/i }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })

  it('passes automated axe-core accessibility checks on dashboard layout', async () => {
    const { container } = render(<App />)

    expect(
      await screen.findByRole('heading', { level: 1, name: /Robot Dashboard/i }, { timeout: 4000 }),
    ).toBeInTheDocument()

    const results = await axe.run(container, {
      rules: {
        // In JSDOM color-contrast checks are often unmeasurable
        'color-contrast': { enabled: false },
      },
    })

    // Critical or serious accessibility violations must be 0
    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )
    expect(criticalViolations).toEqual([])
  })
})
