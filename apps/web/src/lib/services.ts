import type { IAuthService, IRealtimeService, IStorageService } from '@beacon/services'
import { SupabaseAuthService } from './supabase/auth'
import { SupabaseRealtimeService } from './supabase/realtime'
import { SupabaseStorageService } from './supabase/storage'

/**
 * Central service registry.
 * All feature code imports from here — never from @supabase/supabase-js directly.
 * To swap the backend, replace the implementations below without touching features.
 */
export interface Services {
  auth: IAuthService
  realtime: IRealtimeService
  storage: IStorageService
}

export const services: Services = {
  auth: new SupabaseAuthService(),
  realtime: new SupabaseRealtimeService(),
  storage: new SupabaseStorageService(),
}
