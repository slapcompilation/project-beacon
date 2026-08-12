// Branches and proposals — the surface over 461/462's engine.
// "An ontology proposal is analogous to a Pull Request in a version control
// system." (ontologies/review-ontology-proposals)

import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import {
  saveToNewBranch, createProposal, mergeProposal, proposalBlockers,
  taskApprovalStatus, branchConflicts, rebaseBranch, type Json,
} from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import { useAppStore } from '@/stores/app.store'
import { overlayRows } from './overlay'

const keys = {
  branches: (ont: string) => ['ontology-branches', ont] as const,
  changes: (branch: string) => ['branch-changes', branch] as const,
  proposals: (ont: string) => ['ontology-proposals', ont] as const,
  proposal: (id: string) => ['ontology-proposal', id] as const,
}

export interface BranchRow {
  id: string
  name: string
  title: string
  status: 'active' | 'inactive' | 'archived' | 'merged'
  created_at: string
}

export function useBranches(ontologyId: string | null) {
  return useQuery({
    queryKey: keys.branches(ontologyId ?? ''),
    enabled: ontologyId !== null,
    queryFn: async (): Promise<BranchRow[]> => {
      const { data, error } = await supabase.from('ontology_branches')
        .select('id, name, title, status, created_at')
        .eq('ontology_id', ontologyId ?? '')
        .neq('status', 'merged')          // "do not appear in the branch selector"
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as BranchRow[]
    },
  })
}

/** The taskbar's modified-resource panel: what this branch changed. */
export function useBranchChanges(branchId: string | null) {
  return useQuery({
    queryKey: keys.changes(branchId ?? ''),
    enabled: branchId !== null,
    queryFn: async () => {
      const { data, error } = await supabase.from('branch_resource_changes')
        .select('id, resource_kind, resource_id, operation, fields')
        .eq('branch_id', branchId ?? '').order('created_at')
      if (error) throw new Error(error.message)
      return data as { id: string; resource_kind: string; resource_id: string; operation: string; fields: Record<string, unknown> }[]
    },
  })
}

/** "Save to new branch from the save dialog" — atomic: branch + move + save. */
export function useSaveToNewBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { name: string; title?: string }) =>
      client(saveToNewBranch).applyAction({ p_name: i.name, p_title: i.title ?? i.name }),
    onSuccess: () => {
      void qc.invalidateQueries()
      toast.success('Saved to the new branch — main is untouched')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export interface ProposalRow {
  id: string
  branch_id: string
  name: string
  description: string
  status: 'open' | 'merged' | 'closed'
  do_not_merge: boolean
  created_by_user_id: string | null
  created_at: string
  merged_at: string | null
  ontology_branches: { name: string; title: string; ontology_id: string } | null
  proposal_tasks: TaskRow[]
}

export interface TaskRow {
  id: string
  resource_kind: string
  resource_id: string
  auto_approved: boolean
  proposal_reviews: { user_id: string; decision: 'approved' | 'rejected' }[]
}

export function useProposals(ontologyId: string | null) {
  return useQuery({
    queryKey: keys.proposals(ontologyId ?? ''),
    enabled: ontologyId !== null,
    queryFn: async (): Promise<ProposalRow[]> => {
      const { data, error } = await supabase.from('ontology_proposals')
        .select(`id, branch_id, name, description, status, do_not_merge,
                 created_by_user_id, created_at, merged_at,
                 ontology_branches!inner(name, title, ontology_id),
                 proposal_tasks(id, resource_kind, resource_id, auto_approved,
                   proposal_reviews(user_id, decision))`)
        .eq('ontology_branches.ontology_id', ontologyId ?? '')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as unknown as ProposalRow[]
    },
  })
}

/** Every reason a proposal cannot merge; empty means it can. */
export function useProposalBlockers(proposalId: string | null) {
  return useQuery({
    queryKey: [...keys.proposal(proposalId ?? ''), 'blockers'],
    enabled: proposalId !== null,
    queryFn: () => client(proposalBlockers).executeFunction({ p_proposal: proposalId ?? '' }),
  })
}

/** Derived per task — the policy is read at ask time. */
export function useTaskStatus(taskId: string) {
  return useQuery({
    queryKey: ['task-status', taskId],
    queryFn: () => client(taskApprovalStatus).executeFunction({ p_task: taskId }),
  })
}

export function useCreateProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { branchId: string; name: string; description?: string }) =>
      client(createProposal).applyAction({
        p_branch: i.branchId, p_name: i.name, p_description: i.description ?? '' }),
    onSuccess: () => {
      void qc.invalidateQueries()
      toast.success('Proposal created')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** "One standing decision per person per task" — an upsert, so re-reviewing
 *  after a rejection replaces it, which is how the block is lifted. */
export function useReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { taskId: string; decision: 'approved' | 'rejected' }) => {
      const { data: me } = await supabase.auth.getUser()
      const { error } = await supabase.from('proposal_reviews')
        .upsert({ task_id: i.taskId, user_id: me.user?.id ?? '', decision: i.decision },
                { onConflict: 'task_id,user_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries() },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Compose a resource list with the active branch's overlay — the identity
 *  function on main. Feature hooks call this so every list shows the
 *  branch's version while one is active. */
export function useComposeBranch<T extends { id: string }>(
  kind: string, createdDefaults: Partial<T>,
): (rows: T[]) => T[] {
  const branchId = useAppStore((s) => s.omaBranchId)
  const { data: changes = [] } = useBranchChanges(branchId)
  return useCallback(
    (rows: T[]) => (branchId === null ? rows : overlayRows(rows, changes, kind, createdDefaults)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults are a literal
    [branchId, changes, kind],
  )
}

/** True conflicts: "the same property of the same resource was edited on both
 *  main and your branch". */
export function useBranchConflicts(branchId: string | null) {
  return useQuery({
    queryKey: ['branch-conflicts', branchId ?? ''],
    enabled: branchId !== null,
    queryFn: () => client(branchConflicts).executeFunction({ p_branch: branchId ?? '' }),
  })
}

export interface RebaseResolution {
  resource_kind: string
  resource_id: string
  choice: 'main' | 'branch'
}

/** "Finish rebase and save" — choices applied, baselines refreshed. */
export function useRebaseBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { branchId: string; resolutions: RebaseResolution[] }) =>
      client(rebaseBranch).applyAction({
        p_branch: i.branchId, p_resolutions: i.resolutions as unknown as Json }),
    onSuccess: () => {
      void qc.invalidateQueries()
      toast.success('Branch is up to date')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useMergeProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => client(mergeProposal).applyAction({ p_proposal: id }),
    onSuccess: () => {
      void qc.invalidateQueries()
      toast.success('Merged — the branch is terminal now')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
