import type { AuthSession } from '@beacon/types'

export interface IAuthService {
  signIn(email: string, password: string): Promise<AuthSession>
  signOut(): Promise<void>
  getSession(): Promise<AuthSession | null>
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void
  /** Emails a password-reset link that lands on /reset-password. */
  resetPassword(email: string): Promise<void>
  /** Sets a new password for the current (recovery or signed-in) session. */
  updatePassword(newPassword: string): Promise<void>
}
