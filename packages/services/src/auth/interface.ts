import type { AuthSession } from '@beacon/types'

export interface IAuthService {
  signIn(email: string, password: string): Promise<AuthSession>
  signOut(): Promise<void>
  getSession(): Promise<AuthSession | null>
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void
  resetPassword(email: string): Promise<void>
}
