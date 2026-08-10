// The shell renders: the sidebar entries that lead somewhere, the landing page's
// cards, the portal the Applications row opens, the star that fills section ③,
// and Quicksearch's jump-to list.

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/services', () => ({ services: { auth: { signOut: vi.fn() } } }))
// Quicksearch's three server-backed kinds read through these; the fourth (Apps)
// is the registry, which is what the search assertions below use.
vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) },
}))

import { PlatformSidebar } from './PlatformSidebar'
import { useAppStore } from '@/stores/app.store'
import HomePage from '@/pages/HomePage'

// jsdom has no IntersectionObserver; the TOC's active-section effect needs one.
class NoopObserver {
  observe() { /* the TOC just stays on its first entry */ }
  disconnect() { /* nothing to tear down */ }
}

beforeAll(() => { vi.stubGlobal('IntersectionObserver', NoopObserver) })
afterEach(() => {
  cleanup()
  useAppStore.setState({ favoriteApps: [] })
})

const renderShell = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><PlatformSidebar /><HomePage /></MemoryRouter>
  </QueryClientProvider>,
)

describe('platform shell', () => {
  it('shows only the sidebar entries that lead somewhere, sign-out included', () => {
    renderShell()
    for (const label of ['Home', 'Search…', 'Recent', 'Files', 'Applications', 'Account', 'Sign out']) {
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

  it('jumps to a title match, with its kind pill', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: /Search…/ }))
    await user.type(await screen.findByRole('textbox', { name: 'Quicksearch' }), 'ontol')
    const row = await screen.findByRole('button', { name: /Ontology Manager/ })
    expect(row.textContent).toContain('Apps')
    // Jump-to filters rather than lists: the other apps are not in the panel.
    expect(document.querySelectorAll('.qs-row')).toHaveLength(1)
  })

  it('stars an app in the portal, and section ③ appears', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: 'Applications' }))
    await user.click(await screen.findByRole('button', { name: 'Star Ontology Manager' }))
    // The group is absent until something is in it, the way Foundry's is.
    expect(screen.getByText('Applications', { selector: '.platform-section span' })).toBeDefined()
    expect(useAppStore.getState().favoriteApps).toEqual(['/ontology'])
  })
})
