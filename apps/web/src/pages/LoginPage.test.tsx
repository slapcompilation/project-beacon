import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the service so signIn doesn't hit Supabase; we only assert it receives
// the captured values. vi.hoisted lets the mock factory reference the spy safely.
const { signIn, getAal } = vi.hoisted(() => ({ signIn: vi.fn(), getAal: vi.fn() }))
vi.mock('@/lib/services', () => ({ services: { auth: { signIn, getAal } } }))

import LoginPage from './LoginPage'

const EMAIL = 'pansampanidis@gmail.com'
const PW = 'abcdef12'

function renderPage() {
  const { container } = render(<MemoryRouter><LoginPage /></MemoryRouter>)
  return {
    email: container.querySelector('#email') as HTMLInputElement,
    pw: container.querySelector('#password') as HTMLInputElement,
    signInBtn: screen.getByRole('button', { name: /^sign in$/i }),
  }
}

describe('LoginPage value capture', () => {
  beforeEach(() => {
    signIn.mockReset(); signIn.mockResolvedValue(undefined)
    // No MFA factor → password alone reaches full assurance, login proceeds.
    getAal.mockReset(); getAal.mockResolvedValue({ currentLevel: 'aal1', nextLevel: 'aal1' })
  })
  afterEach(() => { cleanup() })

  it('captures TYPED credentials (onChange path)', async () => {
    const user = userEvent.setup()
    const { email, pw, signInBtn } = renderPage()
    await user.type(email, EMAIL)
    await user.type(pw, PW)
    await user.click(signInBtn)
    await waitFor(() => { expect(signIn).toHaveBeenCalledWith(EMAIL, PW) })
  })

  it('captures AUTOFILLED credentials (value set without onChange — needs the ref fix)', async () => {
    const user = userEvent.setup()
    const { email, pw, signInBtn } = renderPage()
    // Simulate browser/password-manager autofill: set the DOM value directly,
    // with no React onChange. RHF must read it from the input via its ref.
    email.value = EMAIL
    pw.value = PW
    await user.click(signInBtn)
    await waitFor(() => { expect(signIn).toHaveBeenCalledWith(EMAIL, PW) })
  })
})
