import { describe, it, expect } from 'vitest'
import { getCoverageHealth } from './coverageHealth'

describe('getCoverageHealth', () => {
  it('identifies unmeasured reports when linesTotal is zero or missing', () => {
    const zeroLines = getCoverageHealth('COMPLETED', 0, 0)
    expect(zeroLines.label).toBe('Unmeasured')
    expect(zeroLines.isMeasured).toBe(false)

    const nullLines = getCoverageHealth('COMPLETED', 0, null)
    expect(nullLines.label).toBe('Unmeasured')
    expect(nullLines.isMeasured).toBe(false)

    const undefinedLines = getCoverageHealth('COMPLETED', 0, undefined)
    expect(undefinedLines.label).toBe('Unmeasured')
    expect(undefinedLines.isMeasured).toBe(false)
  })

  it('identifies processing status for pending and processing uploads', () => {
    const pending = getCoverageHealth('PENDING', null, null)
    expect(pending.label).toBe('Processing')
    expect(pending.isMeasured).toBe(false)

    const processing = getCoverageHealth('PROCESSING', 0, 100)
    expect(processing.label).toBe('Processing')
    expect(processing.isMeasured).toBe(false)
  })

  it('identifies failed status for failed reports', () => {
    const failed = getCoverageHealth('FAILED', 0, 0)
    expect(failed.label).toBe('Failed')
    expect(failed.isMeasured).toBe(false)
  })

  it('evaluates healthy, moderate, and at-risk tiers when linesTotal is positive', () => {
    const healthy = getCoverageHealth('COMPLETED', 85.5, 1000)
    expect(healthy.label).toBe('Healthy')
    expect(healthy.isMeasured).toBe(true)

    const moderate = getCoverageHealth('COMPLETED', 65, 500)
    expect(moderate.label).toBe('Moderate')
    expect(moderate.isMeasured).toBe(true)

    const atRisk = getCoverageHealth('COMPLETED', 30, 200)
    expect(atRisk.label).toBe('At Risk')
    expect(atRisk.isMeasured).toBe(true)

    // Genuine 0% coverage on an instrumented codebase (0 of 50 lines covered) is At Risk
    const zeroCoveredOfFifty = getCoverageHealth('COMPLETED', 0, 50)
    expect(zeroCoveredOfFifty.label).toBe('At Risk')
    expect(zeroCoveredOfFifty.isMeasured).toBe(true)
  })
})
