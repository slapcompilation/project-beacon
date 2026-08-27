// Code Workbook — workbooks, branch-scoped transforms, optional persistence,
// branches and templates (707-709).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import {
  createCodeWorkbook, saveWorkbookTransform, unsaveWorkbookTransform,
  createWorkbookBranch, protectWorkbookBranch, mergeWorkbookBranch,
  deleteWorkbookBranch, workbookBranchPermissions, applyWorkbookTemplate,
  compileWorkbookTransform, runBuild,
} from '@beacon/platform'

export interface Workbook {
  id: string
  rid: string
  projectId: string
  name: string
}

export interface WbBranch {
  id: string
  name: string
  parentBranchId: string | null
  protected: boolean
  allowsRunning: boolean
}

export interface WbImport {
  id: string
  alias: string
  datasetId: string | null
  objectTypeId: string | null
}

export interface WbTransform {
  id: string
  branchId: string
  alias: string
  transformType: string
  language: string
  source: string
  config: Record<string, unknown>
  templateVersionId: string | null
  persisted: boolean
  savedDatasetId: string | null
  position: number
}

export interface WbEdge {
  transformId: string
  inputTransformId: string | null
  inputImportId: string | null
}

export interface WbTemplate {
  id: string
  name: string
  description: string
  defaultPersisted: boolean
}

export interface WbTemplateVersion {
  id: string
  templateId: string
  version: number
  language: string
  status: string
  isDefault: boolean
  parameters: { name: string; type: string; variable_type?: string }[]
}

const keys = {
  list: ['workbooks'] as const,
  one: (id: string) => ['workbook', id] as const,
  templates: ['workbook-templates'] as const,
}

export function useWorkbooks() {
  return useQuery({
    queryKey: keys.list,
    staleTime: 30_000,
    queryFn: async (): Promise<Workbook[]> => {
      const { data, error } = await supabase.from('code_workbooks')
        .select('id, rid, project_id, name').is('trashed_at', null).order('name')
      if (error) throw new Error(error.message)
      return (data as { id: string; rid: string; project_id: string; name: string }[])
        .map((r) => ({ id: r.id, rid: r.rid, projectId: r.project_id, name: r.name }))
    },
  })
}

export interface WorkbookContents {
  branches: WbBranch[]
  imports: WbImport[]
  transforms: WbTransform[]
  edges: WbEdge[]
  permissions: string[]
}

export function useWorkbookContents(id: string | null) {
  return useQuery({
    queryKey: keys.one(id ?? ''),
    enabled: id !== null,
    queryFn: async (): Promise<WorkbookContents> => {
      const [br, im, tr, perms] = await Promise.all([
        supabase.from('workbook_branches')
          .select('id, name, parent_branch_id, protected, allows_running')
          .eq('workbook_id', id ?? '').order('created_at'),
        supabase.from('workbook_imports')
          .select('id, alias, dataset_id, object_type_id')
          .eq('workbook_id', id ?? '').order('alias'),
        supabase.from('workbook_transforms')
          .select('id, branch_id, alias, transform_type, language, source, config, template_version_id, persisted, saved_dataset_id, position')
          .eq('workbook_id', id ?? '').order('position'),
        client(workbookBranchPermissions).executeFunction({ p_workbook: id ?? '' }),
      ])
      for (const r of [br, im, tr]) if (r.error) throw new Error(r.error.message)
      const transforms = (tr.data as {
        id: string; branch_id: string; alias: string; transform_type: string
        language: string; source: string; config: Record<string, unknown>
        template_version_id: string | null; persisted: boolean
        saved_dataset_id: string | null; position: number
      }[]).map((r) => ({
        id: r.id, branchId: r.branch_id, alias: r.alias, transformType: r.transform_type,
        language: r.language, source: r.source, config: r.config,
        templateVersionId: r.template_version_id, persisted: r.persisted,
        savedDatasetId: r.saved_dataset_id, position: r.position,
      }))
      let edges: WbEdge[] = []
      if (transforms.length > 0) {
        const { data: ed, error } = await supabase.from('workbook_transform_inputs')
          .select('transform_id, input_transform_id, input_import_id')
          .in('transform_id', transforms.map((t) => t.id))
        if (error) throw new Error(error.message)
        edges = (ed as {
          transform_id: string; input_transform_id: string | null; input_import_id: string | null
        }[]).map((r) => ({
          transformId: r.transform_id, inputTransformId: r.input_transform_id,
          inputImportId: r.input_import_id,
        }))
      }
      return {
        branches: (br.data as {
          id: string; name: string; parent_branch_id: string | null
          protected: boolean; allows_running: boolean
        }[]).map((r) => ({
          id: r.id, name: r.name, parentBranchId: r.parent_branch_id,
          protected: r.protected, allowsRunning: r.allows_running,
        })),
        imports: (im.data as {
          id: string; alias: string; dataset_id: string | null; object_type_id: string | null
        }[]).map((r) => ({
          id: r.id, alias: r.alias, datasetId: r.dataset_id, objectTypeId: r.object_type_id,
        })),
        transforms,
        edges,
        permissions: perms,
      }
    },
  })
}

export function useTemplates() {
  return useQuery({
    queryKey: keys.templates,
    staleTime: 30_000,
    queryFn: async (): Promise<{ templates: WbTemplate[]; versions: WbTemplateVersion[] }> => {
      const [tp, tv] = await Promise.all([
        supabase.from('workbook_templates')
          .select('id, name, description, default_persisted').order('name'),
        supabase.from('workbook_template_versions')
          .select('id, template_id, version, language, status, is_default, parameters')
          .order('version', { ascending: false }),
      ])
      if (tp.error) throw new Error(tp.error.message)
      if (tv.error) throw new Error(tv.error.message)
      return {
        templates: (tp.data as {
          id: string; name: string; description: string; default_persisted: boolean
        }[]).map((r) => ({
          id: r.id, name: r.name, description: r.description,
          defaultPersisted: r.default_persisted,
        })),
        versions: (tv.data as {
          id: string; template_id: string; version: number; language: string
          status: string; is_default: boolean
          parameters: { name: string; type: string; variable_type?: string }[]
        }[]).map((r) => ({
          id: r.id, templateId: r.template_id, version: r.version, language: r.language,
          status: r.status, isDefault: r.is_default, parameters: r.parameters,
        })),
      }
    },
  })
}

export function useCreateWorkbook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { projectId: string; name: string }) =>
      client(createCodeWorkbook).applyAction({ p_project: i.projectId, p_name: i.name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.list })
      toast.success('Workbook created — its hidden repository came with it')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

function useWbMutation<T>(id: string, fn: (i: T) => Promise<unknown>, done?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.one(id) })
      if (done !== undefined) toast.success(done)
    },
    // CodeWorkbook:AliasTaken, :Cycle, :BranchProtected, :LanguageNotRun …
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useAddImport(id: string) {
  return useWbMutation<{ alias: string; datasetId?: string; objectTypeId?: string }>(
    id, async (i) => {
      const { error } = await supabase.from('workbook_imports').insert({
        workbook_id: id, alias: i.alias,
        dataset_id: i.datasetId ?? null, object_type_id: i.objectTypeId ?? null,
      })
      if (error) throw new Error(error.message)
    }, 'Import added')
}

export function useAddTransform(id: string) {
  return useWbMutation<{
    branchId: string; alias: string; language: string; source: string
    position: number; inputAliases: string[]
    imports: WbImport[]; transforms: WbTransform[]
  }>(id, async (i) => {
    const { data, error } = await supabase.from('workbook_transforms').insert({
      workbook_id: id, branch_id: i.branchId, alias: i.alias,
      language: i.language, source: i.source, position: i.position,
    }).select('id').single()
    if (error) throw new Error(error.message)
    const tid = (data as { id: string }).id
    for (const a of i.inputAliases) {
      const imp = i.imports.find((x) => x.alias === a)
      const tr = i.transforms.find((x) => x.alias === a && x.branchId === i.branchId)
      const { error: e2 } = await supabase.from('workbook_transform_inputs').insert({
        transform_id: tid,
        input_import_id: imp?.id ?? null,
        input_transform_id: imp === undefined ? (tr?.id ?? null) : null,
      })
      if (e2 !== null) throw new Error(e2.message)
    }
  }, 'Transform added')
}

export function useUpdateSource(id: string) {
  return useWbMutation<{ transformId: string; source: string }>(id, async (i) => {
    const { error } = await supabase.from('workbook_transforms')
      .update({ source: i.source }).eq('id', i.transformId)
    if (error) throw new Error(error.message)
  }, 'Saved — the hidden repository has a new commit')
}

/** The Save as dataset toggle, both directions, plus Run for saved nodes. */
export function useSaveTransform(id: string) {
  return useWbMutation<string>(id, async (transformId) => {
    const ds = await client(saveWorkbookTransform).applyAction({
      p_transform: transformId })
    await client(runBuild).applyAction({ p_targets: [ds], p_force: true })
  }, 'Saved and built — the dataset has a new committed transaction')
}

export function useUnsaveTransform(id: string) {
  return useWbMutation<string>(id, async (transformId) => {
    await client(unsaveWorkbookTransform).applyAction({ p_transform: transformId })
  }, 'Unsaved — a logical block again; re-saving re-links')
}

/** Preview an unsaved node: compile only — the SQL is shown, not run,
 *  because unpersisted nodes compute only a preview. */
export function usePreview() {
  return useMutation({
    mutationFn: (transformId: string) =>
      client(compileWorkbookTransform).executeFunction({ p_transform: transformId }),
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useBranchOps(id: string) {
  const qc = useQueryClient()
  const invalidate = () => { void qc.invalidateQueries({ queryKey: keys.one(id) }) }
  const onError = (e: Error) => { toast.error(e.message) }
  return {
    create: useMutation({
      mutationFn: (i: { name: string; parentId: string | null }) =>
        client(createWorkbookBranch).applyAction({
          p_workbook: id, p_name: i.name, p_parent: i.parentId ?? undefined }),
      onSuccess: () => { invalidate(); toast.success('Branch created — logic copied, data pinned') },
      onError,
    }),
    protect: useMutation({
      mutationFn: (i: { branchId: string; protected: boolean }) =>
        client(protectWorkbookBranch).applyAction({
          p_branch: i.branchId, p_protected: i.protected }),
      onSuccess: () => { invalidate(); toast.success('Protection updated') },
      onError,
    }),
    merge: useMutation({
      mutationFn: (branchId: string) =>
        client(mergeWorkbookBranch).applyAction({ p_branch: branchId }),
      onSuccess: () => {
        invalidate()
        toast.success('Merged into the parent — the branch deleted itself')
      },
      onError,
    }),
    remove: useMutation({
      mutationFn: (branchId: string) =>
        client(deleteWorkbookBranch).applyAction({ p_branch: branchId }),
      onSuccess: () => { invalidate(); toast.success('Branch deleted — children re-parented') },
      onError,
    }),
  }
}

export function useApplyTemplate(id: string) {
  return useWbMutation<{
    branchId: string; alias: string; versionId: string; values: Record<string, string>
  }>(id, async (i) => {
    await client(applyWorkbookTemplate).applyAction({
      p_workbook: id, p_branch: i.branchId, p_alias: i.alias,
      p_version: i.versionId, p_values: i.values })
  }, 'Template applied — the instance pins this version')
}
