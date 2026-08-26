// Code Repositories — the repository, its branches, files, commits, pull
// requests, checks and tags (690).
//
// "To edit code in your repository, you must work in a sandbox branch —
// protected branches cannot be directly edited" (code-repositories/
// navigation), so the surface never offers an edit on a protected branch:
// the database refuses it, and the UI agrees rather than inviting a refusal.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import {
  createCodeRepository, mergePullRequest, pullRequestBlockers,
  codeRepositoryKinds, mergeModes, publishTransformBranch,
} from '@beacon/platform'

export interface CodeRepository {
  id: string
  rid: string
  projectId: string
  name: string
  kind: string
  defaultBranch: string
  mergeModes: string[]
}

export interface CodeBranch {
  id: string
  name: string
  protected: boolean
  requirePublishCheck: boolean
  requireCodeReviews: number
  requiredReviewerIds: string[]
  requireSecurityApproval: boolean
}

export interface CodeFile {
  id: string
  branchId: string
  path: string
  content: string
}

export interface CodeCommit {
  id: string
  branchId: string
  message: string
  committedAt: string
}

export interface PullRequest {
  id: string
  sourceBranchId: string
  targetBranchId: string
  title: string
  description: string
  status: 'open' | 'closed' | 'merged'
  mergeMode: string | null
}

export interface CodeReview {
  id: string
  pullRequestId: string
  reviewerId: string
  decision: 'approved' | 'rejected'
  comment: string
}

export interface CodeCheck {
  id: string
  branchId: string
  name: string
  status: 'running' | 'succeeded' | 'failed'
  detail: string
}

export interface CodeTag {
  id: string
  name: string
  commitId: string
}

const keys = {
  repos: ['code-repositories'] as const,
  repo: (id: string) => ['code-repository', id] as const,
}

export function useCodeRepositories() {
  return useQuery({
    queryKey: keys.repos,
    staleTime: 30_000,
    queryFn: async (): Promise<CodeRepository[]> => {
      const { data, error } = await supabase.from('code_repositories')
        .select('id, rid, project_id, name, kind, default_branch, merge_modes')
        .is('trashed_at', null).order('name')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; rid: string; project_id: string; name: string; kind: string
        default_branch: string; merge_modes: string[]
      }[]).map((r) => ({
        id: r.id, rid: r.rid, projectId: r.project_id, name: r.name, kind: r.kind,
        defaultBranch: r.default_branch, mergeModes: r.merge_modes,
      }))
    },
  })
}

export interface RepositoryContents {
  branches: CodeBranch[]
  files: CodeFile[]
  commits: CodeCommit[]
  pullRequests: PullRequest[]
  reviews: CodeReview[]
  checks: CodeCheck[]
  tags: CodeTag[]
}

export function useRepositoryContents(repoId: string | null) {
  return useQuery({
    queryKey: keys.repo(repoId ?? ''),
    enabled: repoId !== null,
    queryFn: async (): Promise<RepositoryContents> => {
      const id = repoId ?? ''
      const [br, fl, cm, pr, ck, tg] = await Promise.all([
        supabase.from('code_branches')
          .select('id, name, protected, require_publish_check, require_code_reviews, required_reviewer_ids, require_security_approval')
          .eq('repository_id', id).order('name'),
        supabase.from('code_files').select('id, branch_id, path, content')
          .eq('repository_id', id).order('path'),
        supabase.from('code_commits').select('id, branch_id, message, committed_at')
          .eq('repository_id', id).order('committed_at', { ascending: false }).limit(100),
        supabase.from('code_pull_requests')
          .select('id, source_branch_id, target_branch_id, title, description, status, merge_mode')
          .eq('repository_id', id).order('created_at', { ascending: false }),
        supabase.from('code_checks').select('id, branch_id, name, status, detail')
          .eq('repository_id', id).order('started_at', { ascending: false }).limit(100),
        supabase.from('code_tags').select('id, name, commit_id').eq('repository_id', id),
      ])
      for (const r of [br, fl, cm, pr, ck, tg]) {
        if (r.error) throw new Error(r.error.message)
      }
      const pullRequests = (pr.data as {
        id: string; source_branch_id: string; target_branch_id: string; title: string
        description: string; status: 'open' | 'closed' | 'merged'; merge_mode: string | null
      }[]).map((r) => ({
        id: r.id, sourceBranchId: r.source_branch_id, targetBranchId: r.target_branch_id,
        title: r.title, description: r.description, status: r.status, mergeMode: r.merge_mode,
      }))
      let reviews: CodeReview[] = []
      if (pullRequests.length > 0) {
        const { data } = await supabase.from('code_reviews')
          .select('id, pull_request_id, reviewer_id, decision, comment')
          .in('pull_request_id', pullRequests.map((p) => p.id))
        reviews = (data as {
          id: string; pull_request_id: string; reviewer_id: string
          decision: 'approved' | 'rejected'; comment: string
        }[] | null ?? []).map((r) => ({
          id: r.id, pullRequestId: r.pull_request_id, reviewerId: r.reviewer_id,
          decision: r.decision, comment: r.comment,
        }))
      }
      return {
        branches: (br.data as {
          id: string; name: string; protected: boolean; require_publish_check: boolean
          require_code_reviews: number; required_reviewer_ids: string[]
          require_security_approval: boolean
        }[]).map((r) => ({
          id: r.id, name: r.name, protected: r.protected,
          requirePublishCheck: r.require_publish_check,
          requireCodeReviews: r.require_code_reviews,
          requiredReviewerIds: r.required_reviewer_ids,
          requireSecurityApproval: r.require_security_approval,
        })),
        files: (fl.data as { id: string; branch_id: string; path: string; content: string }[])
          .map((r) => ({ id: r.id, branchId: r.branch_id, path: r.path, content: r.content })),
        commits: (cm.data as { id: string; branch_id: string; message: string; committed_at: string }[])
          .map((r) => ({ id: r.id, branchId: r.branch_id, message: r.message, committedAt: r.committed_at })),
        pullRequests,
        reviews,
        checks: (ck.data as {
          id: string; branch_id: string; name: string
          status: 'running' | 'succeeded' | 'failed'; detail: string
        }[]).map((r) => ({
          id: r.id, branchId: r.branch_id, name: r.name, status: r.status, detail: r.detail,
        })),
        tags: (tg.data as { id: string; name: string; commit_id: string }[])
          .map((r) => ({ id: r.id, name: r.name, commitId: r.commit_id })),
      }
    },
  })
}

export function useRepositoryKinds() {
  return useQuery({
    queryKey: ['code-repository-kinds'],
    staleTime: Infinity,
    queryFn: () => client(codeRepositoryKinds).executeFunction({}),
  })
}

export function useMergeModes() {
  return useQuery({
    queryKey: ['code-merge-modes'],
    staleTime: Infinity,
    queryFn: () => client(mergeModes).executeFunction({}),
  })
}

/** Every reason a pull request cannot merge; empty means it can. */
export function usePullRequestBlockers(prId: string | null) {
  return useQuery({
    queryKey: ['pr-blockers', prId],
    enabled: prId !== null,
    queryFn: () => client(pullRequestBlockers).executeFunction({ p_pr: prId ?? '' }),
  })
}

export function useCreateRepository() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { projectId: string; name: string; kind: string }) =>
      client(createCodeRepository).applyAction({
        p_project: i.projectId, p_name: i.name, p_kind: i.kind }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.repos }); toast.success('Repository created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

function useRepoMutation<T>(repoId: string, fn: (i: T) => Promise<void>, done?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.repo(repoId) })
      void qc.invalidateQueries({ queryKey: ['pr-blockers'] })
      if (done !== undefined) toast.success(done)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useCreateBranch(repoId: string) {
  return useRepoMutation<string>(repoId, async (name) => {
    const { error } = await supabase.from('code_branches')
      .insert({ repository_id: repoId, name })
    if (error) throw new Error(error.message)
  }, 'Sandbox branch created')
}

export function useSaveFile(repoId: string) {
  return useRepoMutation<{ branchId: string; path: string; content: string }>(
    repoId, async (i) => {
      const { error } = await supabase.from('code_files')
        .upsert({ repository_id: repoId, branch_id: i.branchId, path: i.path,
                  content: i.content, updated_at: new Date().toISOString() },
                { onConflict: 'branch_id,path' })
      if (error) throw new Error(error.message)
    }, 'Saved')
}

export function useCommit(repoId: string) {
  return useRepoMutation<{ branchId: string; message: string; parentId: string | null }>(
    repoId, async (i) => {
      const { error } = await supabase.from('code_commits').insert({
        repository_id: repoId, branch_id: i.branchId,
        message: i.message, parent_id: i.parentId,
      })
      if (error) throw new Error(error.message)
    }, 'Committed')
}

export function useProposeChanges(repoId: string) {
  return useRepoMutation<{ sourceBranchId: string; targetBranchId: string; title: string }>(
    repoId, async (i) => {
      const { error } = await supabase.from('code_pull_requests').insert({
        repository_id: repoId, source_branch_id: i.sourceBranchId,
        target_branch_id: i.targetBranchId, title: i.title,
      })
      if (error) throw new Error(error.message)
    }, 'Pull request created')
}

export function useReview(repoId: string) {
  return useRepoMutation<{ pullRequestId: string; decision: 'approved' | 'rejected'; comment: string }>(
    repoId, async (i) => {
      const { data: me } = await supabase.auth.getUser()
      const { error } = await supabase.from('code_reviews').upsert({
        pull_request_id: i.pullRequestId, reviewer_id: me.user?.id ?? '',
        decision: i.decision, comment: i.comment,
      }, { onConflict: 'pull_request_id,reviewer_id' })
      if (error) throw new Error(error.message)
    }, 'Review submitted')
}

export function useMerge(repoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { prId: string; mode?: string }) =>
      client(mergePullRequest).applyAction({
        p_pr: i.prId, ...(i.mode !== undefined ? { p_mode: i.mode } : {}) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.repo(repoId) })
      void qc.invalidateQueries({ queryKey: ['pr-blockers'] })
      toast.success('Merged')
    },
    // CodeRepositories:MergeBlocked, :MergeModeNotOffered — the name is the
    // useful half, and the blockers list already said why.
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** What ci/foundry-publish does: derive a job spec from every SQL transform
 *  on the branch. "In order to publish changes to your data, the continuous
 *  integration process must run and finish successfully" — a failure is
 *  recorded as a failed check rather than thrown away. */
export function usePublishBranch(repoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (branchId: string) =>
      client(publishTransformBranch).applyAction({ p_branch: branchId }),
    onSuccess: (n) => {
      void qc.invalidateQueries({ queryKey: keys.repo(repoId) })
      void qc.invalidateQueries({ queryKey: ['pr-blockers'] })
      toast.success(`Published ${String(n)} transform${n === 1 ? '' : 's'} — see the Checks tab`)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useCreateTag(repoId: string) {
  return useRepoMutation<{ name: string; commitId: string }>(repoId, async (i) => {
    const { error } = await supabase.from('code_tags')
      .insert({ repository_id: repoId, name: i.name, commit_id: i.commitId })
    if (error) throw new Error(error.message)
  }, 'Tag created')
}
