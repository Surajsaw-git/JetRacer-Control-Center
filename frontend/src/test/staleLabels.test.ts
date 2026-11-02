import { describe, it, expect } from 'vitest'
import packageJson from '../../package.json'

describe('Stale Labels & Version Audit (Bug 6)', () => {
  it('statically enforces that no production file contains "NOT WIRED IN PHASE 3"', () => {
    const modules = import.meta.glob<string>('../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    })

    const violations: string[] = []

    for (const [filepath, content] of Object.entries(modules)) {
      if (filepath.includes('.test.')) continue

      if (typeof content === 'string' && /NOT WIRED IN PHASE 3/i.test(content)) {
        violations.push(filepath)
      }
    }

    expect(violations).toEqual([])
  })

  it('matches RootLayout footer with real build version and current phase', () => {
    const rootLayoutRaw = import.meta.glob<string>('../layouts/RootLayout.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    })['../layouts/RootLayout.tsx']

    expect(typeof rootLayoutRaw).toBe('string')
    // Must NOT contain v0.2.0 or Phase 1 UI
    expect(rootLayoutRaw).not.toContain('v0.2.0')
    expect(rootLayoutRaw).not.toContain('Phase 1 UI')

    // Must match packageJson version
    expect(rootLayoutRaw).toContain(packageJson.version)
  })
})
