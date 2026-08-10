// The shell renders: the five sidebar entries that lead somewhere, the landing
// page's cards, and the portal the Applications row opens.

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/lib/services', () => ({ services: { auth: { signOut: vi.fn() } } }))

import { PlatformSidebar } from './PlatformSidebar'
import { useAppStore } from '@/stores/app.store'
import HomePage from '@/pages/HomePage'

// jsdom has no IntersectionObserver; the TOC's active-section effect needs one.
class NoopObserver {
  observe() { /* the TOC just stays on its first entry */ }
  disconnect() { /* nothing to tear down */ }
}

beforeAll(() => { vi.stubGlobal('IntersectionObserver', NoopObserver) })
afterEach(() => { cleanup() })

const renderShell = () => render(
  <MemoryRouter><PlatformSidebar /><HomePage /></MemoryRouter>,
)

describe('platform shell', () => {
  it('shows only the sidebar entries that lead somewhere, sign-out included', () => {
    renderShell()
    for (const label of ['Home', 'Recent', 'Files', 'Applications', 'Account', 'Sign out']) {
      expect(screen.getByRole('button', { name: label })).toBeDefined()
    }
    expect(screen.queryByRole('button', { name: /notifications|what's new/i })).toBeNull()
  })

  it('lands on the welcome banner and the app cards', () => {
    renderShell()
    expect(screen.getByText(/Welcome to Beacon/)).toBeDefined()
    expect(screen.getByRole('link', { name: /Ontology Manager/ }).getAttribute('href')).toBe('/ontology')
    expect(screen.getByRole('link', { name: /Dataset/ }).getAttribute('href')).toBe('/datasets')
    expect(screen.getByRole('heading', { name: 'Applications for Data Ops' })).toBeDefined()
  })

  it('lists visited pages under Recent, by title', async () => {
    const user = userEvent.setup()
    useAppStore.getState().pushRecent('/ontology')
    renderShell()
    await user.click(screen.getByRole('button', { name: 'Recent' }))
    expect(await screen.findByRole('menuitem', { name: /Ontology Manager/ })).toBeDefined()
  })

  it('opens the Applications Portal over the page', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: 'Applications' }))
    expect(await screen.findByText('Applications Portal')).toBeDefined()
    expect(screen.getByRole('button', { name: /All apps/ })).toBeDefined()
  })
})
