import { supabase } from '@/lib/supabase/client'
import type { UserRole } from '@beacon/types'

export interface TeamMember {
  id: string
  hotel_id: string
  email: string
  role: UserRole
  created_at: string
}

export async function fetchTeamMembers(hotelId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, hotel_id, email, role, created_at')
    .eq('hotel_id', hotelId)
    .order('created_at')

  if (error) throw new Error(error.message)
  return data as TeamMember[]
}

export async function inviteTeamMember(email: string, role: string): Promise<void> {
  const result = await supabase.functions.invoke('invite-member', {
    body: { email, role },
  }) as { data: unknown; error: { message: string } | null }
  const { error } = result
  if (error) throw new Error(error.message)
}

export async function updateMemberRole(userId: string, role: string): Promise<void> {
  const { error } = await supabase.rpc('update_member_role', {
    p_user_id: userId,
    p_role: role,
  })
  if (error) throw new Error(error.message)
}

export async function removeTeamMember(userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_team_member', {
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
}
