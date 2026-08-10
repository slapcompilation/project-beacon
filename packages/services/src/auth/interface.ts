/** Platform roles. Resource roles (owner/editor/viewer/discoverer) live on a
 *  project grant, which is Compass's model, not this one. */
export type UserRole = 'owner' | 'admin'

export interface AuthSession {
  user: {
    id: string
    email: string
    organization_id: string
    role: UserRole
  }
  access_token: string
  expires_at: number
}

/** Supabase provider slugs: 'azure' is Microsoft. */
export type OAuthProvider = 'google' | 'azure'

/** Authenticator Assurance Level. nextLevel === 'aal2' means the user has a
 *  verified factor and must complete an MFA challenge to reach full assurance. */
export interface AalStatus {
  currentLevel: 'aal1' | 'aal2' | null
  nextLevel: 'aal1' | 'aal2' | null
}

export interface MfaFactor {
  id: string
  friendlyName?: string
  status: 'verified' | 'unverified'
}

export interface MfaEnrollment {
  factorId: string
  /** SVG/data-URL QR the user scans in their authenticator app. */
  qrCode: string
  /** Manual-entry secret (fallback when the QR can't be scanned). */
  secret: string
}

export interface IAuthService {
  signIn(email: string, password: string): Promise<AuthSession>
  signOut(): Promise<void>
  getSession(): Promise<AuthSession | null>
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void
  /** Emails a password-reset link that lands on /reset-password. */
  resetPassword(email: string): Promise<void>
  /** Sets a new password for the current (recovery or signed-in) session. */
  updatePassword(newPassword: string): Promise<void>
  /** Redirects the browser to an OAuth provider; returns to /auth/callback with a session. */
  signInWithOAuth(provider: OAuthProvider): Promise<void>

  // ── Multi-factor auth (TOTP) ──────────────────────────────────────────────
  /** Current vs required assurance level — drives the post-password challenge. */
  getAal(): Promise<AalStatus>
  /** The caller's enrolled TOTP factors. */
  listMfaFactors(): Promise<MfaFactor[]>
  /** Begin TOTP enrollment; returns the QR + secret to confirm with a code. */
  enrollTotp(): Promise<MfaEnrollment>
  /** Challenge + verify a TOTP code — confirms enrollment or satisfies a login challenge. */
  verifyTotp(factorId: string, code: string): Promise<void>
  /** Remove an enrolled factor. */
  unenrollMfa(factorId: string): Promise<void>
}
