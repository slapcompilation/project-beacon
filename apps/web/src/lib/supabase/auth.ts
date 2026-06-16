import type { Session } from '@supabase/supabase-js'
import type { AalStatus, IAuthService, MfaEnrollment, MfaFactor } from '@beacon/services'
import type { AuthSession, UserRole } from '@beacon/types'
import { supabase } from './client'

export class SupabaseAuthService implements IAuthService {
  async signIn(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    return this.mapSession(data.session)
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw new Error(error.message)
    if (!data.session) return null
    return this.mapSession(data.session)
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session ? this.mapSession(session) : null)
    })
    return () => { subscription.unsubscribe(); }
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw new Error(error.message)
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message)
  }

  async getAal(): Promise<AalStatus> {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error) throw new Error(error.message)
    return { currentLevel: data.currentLevel, nextLevel: data.nextLevel }
  }

  async listMfaFactors(): Promise<MfaFactor[]> {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) throw new Error(error.message)
    return data.totp.map((f) => ({
      id: f.id,
      friendlyName: f.friendly_name,
      status: f.status,
    }))
  }

  async enrollTotp(): Promise<MfaEnrollment> {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (error) throw new Error(error.message)
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
  }

  async verifyTotp(factorId: string, code: string): Promise<void> {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (error) throw new Error(error.message)
  }

  async unenrollMfa(factorId: string): Promise<void> {
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    if (error) throw new Error(error.message)
  }

  private mapSession(session: Session): AuthSession {
    const appMeta = session.user.app_metadata as {
      hotel_id?: string
      role?: UserRole
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email ?? '',
        hotel_id: appMeta.hotel_id ?? '',
        role: appMeta.role ?? 'limited_access',
      },
      access_token: session.access_token,
      expires_at: session.expires_at ?? 0,
    }
  }
}
