// The read side follows the branch the save follows (creation review, F4).
// The regression this pins: useWorkingState hardcoded `branch_id IS NULL`
// while useSaveWorkingState passed the ambient branch — branch edits were
// invisible to the count and the dialog, and a user with only branch entries
// had no Save control at all.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const calls: { table: string; filter: [string, string, unknown] | null }[] = []
vi.mock('@/lib/supabase/client', () => {
  const make = (table: string) => {
    const rec: { table: string; filter: [string, string, unknown] | null } = { table, filter: null }
    calls.push(rec)
    const p = Promise.resolve({ data: [], error: null })
    const chain = {
      select: () => chain,
      order: () => chain,
      is: (col: string, v: unknown) => { rec.filter = ['is', col, v]; return chain },
      eq: (col: string, v: unknown) => { rec.filter = ['eq', col, v]; return chain },
      then: p.then.bind(p),
    }
    return chain
  }
  return { supabase: { from: make } }
})

const fnCalls: { apiName: string; input: unknown }[] = []
vi.mock('@/lib/supabase/ontologyClient', () => ({
  client: (entity: { apiName: string }) => ({
    executeFunction: (input: unknown) => {
      fnCalls.push({ apiName: entity.apiName, input })
      return Promise.resolve([])
    },
    applyAction: (input: unknown) => {
      fnCalls.push({ apiName: entity.apiName, input })
      return Promise.resolve(0)
    },
  }),
}))

import { useWorkingState, useWorkingStateConflicts } from './api'
import { useAppStore } from '@/stores/app.store'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

afterEach(() => { cleanup(); calls.length = 0; fnCalls.length = 0 })

describe('the working state reads the branch the save writes', () => {
  it('on main, entries filter on branch_id IS NULL', async () => {
    useAppStore.setState({ omaBranchId: null })
    const { result } = renderHook(() => useWorkingState(), { wrapper })
    await waitFor(() => { expect(result.current.isSuccess).toBe(true) })
    const q = calls.find((c) => c.table === 'working_state_changes')
    expect(q?.filter).toEqual(['is', 'branch_id', null])
  })

  it('on a branch, entries filter on that branch — the F4 regression', async () => {
    useAppStore.setState({ omaBranchId: 'br1' })
    const { result } = renderHook(() => useWorkingState(), { wrapper })
    await waitFor(() => { expect(result.current.isSuccess).toBe(true) })
    const q = calls.find((c) => c.table === 'working_state_changes')
    expect(q?.filter).toEqual(['eq', 'branch_id', 'br1'])
    useAppStore.setState({ omaBranchId: null })
  })

  it('conflicts carry the branch too', async () => {
    useAppStore.setState({ omaBranchId: 'br1' })
    const { result } = renderHook(() => useWorkingStateConflicts(), { wrapper })
    await waitFor(() => { expect(result.current.isSuccess).toBe(true) })
    expect(fnCalls).toContainEqual({
      apiName: 'working_state_conflicts', input: { p_branch: 'br1' },
    })
    useAppStore.setState({ omaBranchId: null })
  })
})
