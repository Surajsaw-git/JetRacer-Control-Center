import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axe from 'axe-core'
import { CameraPage } from '@/pages/Camera/CameraPage'

describe('Camera Page Accessibility (axe-core)', () => {
  it('passes automated accessibility audit with 0 critical or serious violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <CameraPage />
      </MemoryRouter>,
    )

    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false }, // Handled across theme testing
      },
    })

    const criticalViolations = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )

    expect(criticalViolations).toEqual([])
  })
})
