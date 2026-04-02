import { create } from 'zustand'
import type { AuthSession, UserRole } from '@beacon/types'

interface AuthState {
  session: AuthSession | null
  isLoading: boolean
  isAuthenticated: boolean
  // Derived helpers
  userId: string | null
  hotelId: string | null
  role: UserRole | null
  // Actions
  setSession: (session: AuthSession | null) => void
  setLoading: (loading: boolean) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: true, // true on init — resolves once getSession() completes
  isAuthenticated: false,
  userId: null,
  hotelId: null,
  role: null,

  setSession: (session) =>
    { set({
      session,
      isAuthenticated: session !== null,
      userId: session?.user.id ?? null,
      hotelId: session?.user.hotel_id ?? null,
      role: session?.user.role ?? null,
      isLoading: false,
    }); },

  setLoading: (isLoading) => { set({ isLoading }); },

  clearSession: () =>
    { set({
      session: null,
      isAuthenticated: false,
      userId: null,
      hotelId: null,
      role: null,
      isLoading: false,
    }); },
}))
