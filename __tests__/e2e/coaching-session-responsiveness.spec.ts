import { test, expect } from '@playwright/test'
import {
  setupAuthentication,
  mockCommonApiRoutes,
} from './helpers'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const SESSION_ID = 'session-resp-1'

const MOCK_SESSION = {
  id: SESSION_ID,
  coaching_relationship_id: 'rel-1',
  date: '2026-03-24T16:30:00Z',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Viewport widths to test — covers mobile, md breakpoint, intermediate
// widths where overflow previously occurred, and full desktop.
// ---------------------------------------------------------------------------

const VIEWPORTS = [
  { width: 375, height: 812, label: 'mobile (375px)' },
  { width: 768, height: 768, label: 'md breakpoint (768px)' },
  { width: 900, height: 768, label: 'intermediate (900px)' },
  { width: 1024, height: 768, label: 'tablet (1024px)' },
  { width: 1280, height: 800, label: 'desktop (1280px)' },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Coaching session page responsiveness', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuthentication(page, context)
    await mockCommonApiRoutes(page, {
      coachingSessions: [MOCK_SESSION],
    })
  })

  for (const viewport of VIEWPORTS) {
    test(`no horizontal overflow at ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })

      await page.goto(`/coaching-sessions/${SESSION_ID}`)

      // Wait for the page to render the Notes heading (indicates layout is complete)
      await page.getByRole('heading', { name: 'Notes' }).waitFor({ state: 'visible' })

      // Core assertion: document scroll width should not exceed viewport,
      // meaning no content is overflowing horizontally.
      const bodyScrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth
      )
      expect(
        bodyScrollWidth,
        `Content overflows viewport at ${viewport.width}px: scrollWidth=${bodyScrollWidth}`
      ).toBeLessThanOrEqual(viewport.width)

      // The notes section should be visible
      await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible()
    })
  }
})
