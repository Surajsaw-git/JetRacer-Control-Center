import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConnectionWizard } from '@/components/common/ConnectionWizard'
import { useConnectionStore } from '@/store/connectionStore'
import { useSettingsStore } from '@/store/settingsStore'

describe('ConnectionWizard Component', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset()
    useSettingsStore.getState().resetToDefaults()
    vi.restoreAllMocks()
  })

  it('renders target address input and connect button', () => {
    render(<ConnectionWizard />)
    expect(screen.getByPlaceholderText(/e\.g\. 192\.168\.1\.100/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^connect$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /local mock \(127\.0\.0\.1\)/i })).toBeInTheDocument()
  })

  it('populates 127.0.0.1 on clicking Quick-fill Mock', () => {
    render(<ConnectionWizard />)
    const quickFillBtn = screen.getByRole('button', { name: /local mock \(127\.0\.0\.1\)/i })
    fireEvent.click(quickFillBtn)

    const input = screen.getByPlaceholderText(/e\.g\. 192\.168\.1\.100/i) as HTMLInputElement
    expect(input.value).toBe('127.0.0.1')
    expect(screen.getByText(/own computer \(loopback\)/i)).toBeInTheDocument()
  })

  it('displays validation error for 0.0.0.0', () => {
    render(<ConnectionWizard />)
    const input = screen.getByPlaceholderText(/e\.g\. 192\.168\.1\.100/i)
    fireEvent.change(input, { target: { value: '0.0.0.0' } })

    expect(screen.getByText(/0\.0\.0\.0 is an unbound listening address/i)).toBeInTheDocument()
    const connectBtn = screen.getByRole('button', { name: /^connect$/i })
    expect(connectBtn).toBeDisabled()
  })

  it('displays Link A and Link B diagnostic status sections', () => {
    render(<ConnectionWizard />)
    expect(screen.getByText(/Link A: Rosbridge WebSocket/i)).toBeInTheDocument()
    expect(screen.getByText(/Link B: FastAPI Backend/i)).toBeInTheDocument()
    expect(screen.getByText(/Phase 3 Read-Only/i)).toBeInTheDocument()
  })

  it('renders Copy Diagnostics button and copies formatted diagnostic summary', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(<ConnectionWizard />)
    const copyBtn = screen.getByRole('button', { name: /copy diagnostics/i })
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalled()
    const copiedText = writeTextMock.mock.calls[0][0]
    expect(copiedText).toContain('JetRacer Connection Diagnostics')
    expect(copiedText).toContain('LINK A - Rosbridge WebSocket')
    expect(copiedText).toContain('LINK B - FastAPI Backend')
  })
})
