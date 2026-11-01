import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { BrowserRouter } from 'react-router-dom'
import { SystemPage } from '@/pages/System/SystemPage'

describe('System Page & Tabbed Introspection Accessibility (axe-core)', () => {
  it('passes automated accessibility audits on all System tabs', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <BrowserRouter>
        <SystemPage />
      </BrowserRouter>,
    )

    // Verify initial Status tab
    expect(screen.getByRole('heading', { level: 1, name: /ROS 1 & System Management/i })).toBeInTheDocument()

    const runAxeAudit = async () => {
      const results = await axe.run(container, {
        rules: {
          'color-contrast': { enabled: false }, // JSDOM color calculation limitations
        },
      })
      const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      )
      expect(criticalViolations).toEqual([])
    }

    // 1. Audit Status tab
    await runAxeAudit()

    // 2. Audit Topics tab
    await user.click(screen.getByRole('tab', { name: /Topics/i }))
    await runAxeAudit()

    // 3. Audit Nodes tab
    await user.click(screen.getByRole('tab', { name: /Nodes/i }))
    await runAxeAudit()

    // 4. Audit Services tab
    await user.click(screen.getByRole('tab', { name: /Services/i }))
    await runAxeAudit()

    // 5. Audit Watch tab
    await user.click(screen.getByRole('tab', { name: /Watch/i }))
    await runAxeAudit()

    // 6. Audit Registry tab
    await user.click(screen.getByRole('tab', { name: /Registry/i }))
    await runAxeAudit()
  })
})
