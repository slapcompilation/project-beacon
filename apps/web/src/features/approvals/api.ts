// The Approvals data layer. One listing call (652) carries every request the
// caller may see, each task with the caller's computed eligibility — the
// server derives it from "the permission to perform an action themselves";
// the client never guesses. Every write goes through 651's definer functions.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export type ApprovalRequestStatus =
  | 'pending_approval' | 'closed' | 'rejected_and_closed'
  | 'changes_requested' | 'completed'
export type ApprovalTaskStatus = 'review' | 'approved' | 'rejected'
export type ApprovalTaskKind =
  | 'group_membership' | 'project_role' | 'marking_member' | 'ontology_proposal'

export interface ApprovalTask {
  id: string
  kind: ApprovalTaskKind
  payload: Partial<Record<string, string>>
  status: ApprovalTaskStatus
  reviewed_at: string | null
  can_review: boolean
  labels: Partial<Record<string, string>>
}

export interface ApprovalRequest {
  id: string
  title: string
  justification: string
  status: ApprovalRequestStatus
  mine: boolean
  creator: string | null
  created_at: string
  completed_at: string | null
  closed_at: string | null
  tasks: ApprovalTask[]
}

export interface ApprovalComment {
  id: string
  task_id: string | null
  author: string | null
  body: string
  is_system: boolean
  created_at: string
}

export const REQUEST_OPEN: ApprovalRequestStatus[] = ['pending_approval', 'changes_requested']

export function useApprovals() {
  return useQuery({
    queryKey: ['approvals'],
    queryFn: async (): Promise<ApprovalRequest[]> => {
      const res = (await supabase.rpc('approval_requests_listing')) as {
        data: ApprovalRequest[] | null
        error: { message: string } | null
      }
      if (res.error) throw new Error(res.error.message)
      return res.data ?? []
    },
  })
}

export function useApprovalComments(requestId: string | null) {
  return useQuery({
    queryKey: ['approvals', 'comments', requestId],
    enabled: requestId !== null,
    queryFn: async (): Promise<ApprovalComment[]> => {
      const { data, error } = await supabase.from('approval_request_comments')
        .select('id, task_id, author, body, is_system, created_at')
        .eq('request_id', requestId ?? '')
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      return data as ApprovalComment[]
    },
  })
}

function approvalMutation<A>(fn: string, toArgs: (a: A) => Record<string, unknown>, done: string) {
  return function useIt() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (a: A) => {
        const res = (await supabase.rpc(fn, toArgs(a))) as {
          error: { message: string } | null
        }
        if (res.error) throw new Error(res.error.message)
      },
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['approvals'] })
        toast.success(done)
      },
      onError: (e: Error) => { toast.error(e.message) },
    })
  }
}

export const useReviewTask = approvalMutation<{ taskId: string; decision: 'approved' | 'rejected' }>(
  'review_approval_task', (a) => ({ p_task: a.taskId, p_decision: a.decision }), 'Review recorded')
export const useCloseRequest = approvalMutation<{ requestId: string; rejected: boolean }>(
  'close_approval_request', (a) => ({ p_request: a.requestId, p_rejected: a.rejected }), 'Request closed')
export const useRequestChanges = approvalMutation<{ requestId: string }>(
  'request_approval_changes', (a) => ({ p_request: a.requestId }), 'Changes requested')
export const useEditRequest = approvalMutation<{ requestId: string; title: string; justification: string }>(
  'edit_approval_request',
  (a) => ({ p_request: a.requestId, p_title: a.title, p_justification: a.justification }),
  'Request updated')
export const useCommentOnRequest = approvalMutation<{ requestId: string; taskId: string | null; body: string }>(
  'comment_on_approval_request',
  (a) => ({ p_request: a.requestId, p_task: a.taskId, p_body: a.body }), 'Comment added')

// Display vocabulary: the pages' own names for what the tokens store.
export const REQUEST_STATUS_LABEL: Record<ApprovalRequestStatus, string> = {
  pending_approval: 'Pending approval',
  changes_requested: 'Changes requested',
  completed: 'Completed',
  closed: 'Closed',
  rejected_and_closed: 'Rejected and closed',
}

export const TASK_KIND_LABEL: Record<ApprovalTaskKind, string> = {
  group_membership: 'Group membership',
  project_role: 'Project access request',
  marking_member: 'Marking access request',
  ontology_proposal: 'Ontology proposal',
}

/** The typed field rows the request capture draws, per kind, in order. */
export const TASK_FIELD_ROWS: Record<ApprovalTaskKind, { key: string; label: string }[]> = {
  group_membership: [
    { key: 'user', label: 'User to add' },
    { key: 'group', label: 'Group to update' },
  ],
  project_role: [
    { key: 'user', label: 'User to add' },
    { key: 'project', label: 'Target project' },
    { key: 'role', label: 'Role on project' },
  ],
  marking_member: [
    { key: 'marking', label: 'Marking' },
    { key: 'user', label: 'User to add' },
  ],
  ontology_proposal: [
    { key: 'proposal', label: 'Proposal' },
  ],
}
