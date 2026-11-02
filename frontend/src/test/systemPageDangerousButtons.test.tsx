import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SystemPage } from '@/pages/System/SystemPage'

describe('System Page Host Management Button Guard (Bug 5)', () => {
  it('renders Restart Backend, Reboot Jetson, and Shutdown as visibly disabled with informative tooltip', () => {
    render(
      <MemoryRouter>
        <SystemPage />
      </MemoryRouter>,
    )

    const restartBtn = screen.getByRole('button', { name: /Restart Backend/i })
    const rebootBtn = screen.getByRole('button', { name: /Reboot Jetson/i })
    const shutdownBtn = screen.getByRole('button', { name: /Shutdown/i })

    // Must be disabled
    expect(restartBtn).toBeDisabled()
    expect(rebootBtn).toBeDisabled()
    expect(shutdownBtn).toBeDisabled()

    // Must carry aria-disabled or informative title
    expect(restartBtn).toHaveAttribute('title', expect.stringMatching(/Not available until Phase 10/i))
    expect(rebootBtn).toHaveAttribute('title', expect.stringMatching(/Not available until Phase 10/i))
    expect(shutdownBtn).toHaveAttribute('title', expect.stringMatching(/Not available until Phase 10/i))
  })

  it('guarantees that clicking host buttons performs zero network calls and opens no dialog', () => {
    const fetchSpy = vi.spyOn(window, 'fetch')

    render(
      <MemoryRouter>
        <SystemPage />
      </MemoryRouter>,
    )

    const shutdownBtn = screen.getByRole('button', { name: /Shutdown/i })
    fireEvent.click(shutdownBtn)

    // No confirmation dialog or text like "Shutting down the robot"
    expect(screen.queryByText(/Are you sure you want to shut down/i)).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
