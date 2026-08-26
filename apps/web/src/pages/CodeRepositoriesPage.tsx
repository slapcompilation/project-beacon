// Code Repositories — the repository list, and one repository in its tabs.
//
// "There are five different tabs that you can select at the top of the Code
// Repositories interface" (code-repositories/navigation): Code, Branches,
// Pull requests, Checks, Settings. The Code tab's own chrome follows the
// capture (code-repositories/images/code-view.png): a branch dropdown on the
// left of an action row reading Preview · Test · Commit · Build · Propose
// changes, a Files tree, and the editor beside it.
//
// The IDE is deliberately absent — Code Assist, IntelliSense, the nine
// helper panels, the debugger. What is here is the repository: its
// branches, files, commits, pull requests, checks and tags.

import { useState } from 'react'
import {
  Button, Callout, Card, Dialog, DialogBody, HTMLSelect, Icon, InputGroup,
  Intent, NonIdealState, Spinner, SpinnerSize, Tab, Tabs, Tag, TextArea,
} from '@blueprintjs/core'
import { useSearchParams } from 'react-router-dom'
import { useProjects } from '@/features/projects/api'
import {
  useCodeRepositories, useRepositoryContents, useCreateRepository, useRepositoryKinds,
  useCreateBranch, useSaveFile, useCommit, useProposeChanges, useReview, useMerge,
  useCreateTag, usePullRequestBlockers, usePublishBranch,
  type CodeRepository, type RepositoryContents, type PullRequest,
} from '@/features/codeRepositories/api'

export default function CodeRepositoriesPage() {
  const { data: repos = [], isLoading } = useCodeRepositories()
  const [params, setParams] = useSearchParams()
  const openId = params.get('r')
  const open = repos.find((r) => r.id === openId) ?? null

  if (open) return <RepositoryView repo={open} onClose={() => { setParams({}) }} />

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Code Repositories</h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              Author data transformations and functions. Editing happens on a sandbox branch;
              reaching a protected branch is a pull request.
            </p>
          </div>
          <NewRepositoryButton />
        </header>

        {isLoading ? (
          <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </Card>
        ) : repos.length === 0 ? (
          <NonIdealState icon="code" title="No repositories yet"
            description="A repository holds code in a project — transforms that build datasets, or functions that run against the ontology." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {repos.map((r) => (
              <Card key={r.id} interactive compact onClick={() => { setParams({ r: r.id }) }}>
                <div className="flex items-center gap-2">
                  <Icon icon="code" size={14} className="text-violet-500" />
                  <span className="text-sm font-semibold truncate">{r.name}</span>
                  <Tag minimal className="!text-[9px] ml-auto">{r.kind}</Tag>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{r.rid}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewRepositoryButton() {
  const { data: projects = [] } = useProjects()
  const { data: kinds = [] } = useRepositoryKinds()
  const create = useCreateRepository()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState('')
  const [kind, setKind] = useState('transforms')

  return (
    <>
      <Button intent={Intent.PRIMARY} icon="add" onClick={() => { setOpen(true) }}>
        New repository
      </Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="New code repository">
        <DialogBody>
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="cr-label">Name</span>
              <InputGroup value={name} placeholder="Example Code Repository"
                onChange={(e) => { setName(e.currentTarget.value) }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="cr-label">Project</span>
              <HTMLSelect value={projectId} onChange={(e) => { setProjectId(e.currentTarget.value) }}>
                <option value="">Pick a project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </HTMLSelect>
            </label>
            <label className="flex flex-col gap-1">
              <span className="cr-label">Type</span>
              <HTMLSelect value={kind} onChange={(e) => { setKind(e.currentTarget.value) }}>
                {kinds.map((k) => <option key={k.kind} value={k.kind}>{k.kind}</option>)}
              </HTMLSelect>
              <span className="cr-hint">
                {kinds.find((k) => k.kind === kind)?.note ?? ''}
              </span>
            </label>
            <p className="cr-hint">
              The repository starts on a protected master requiring one approving review —
              so the first change is a sandbox branch and a pull request.
            </p>
            <Button intent={Intent.PRIMARY} icon="tick" loading={create.isPending}
              disabled={name.trim() === '' || projectId === ''}
              onClick={() => {
                create.mutate({ projectId, name: name.trim(), kind },
                  { onSuccess: () => { setOpen(false); setName('') } })
              }}>Create</Button>
          </div>
        </DialogBody>
      </Dialog>
    </>
  )
}

function RepositoryView({ repo, onClose }: { repo: CodeRepository; onClose: () => void }) {
  const { data: contents } = useRepositoryContents(repo.id)
  const [tab, setTab] = useState('code')
  const [branchId, setBranchId] = useState<string | null>(null)

  if (!contents) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size={SpinnerSize.SMALL} /></div>
  }
  const branch = contents.branches.find((b) => b.id === branchId)
    ?? contents.branches.find((b) => b.name === repo.defaultBranch)
    ?? contents.branches.at(0) ?? null
  const openPrs = contents.pullRequests.filter((p) => p.status === 'open')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="cr-header">
        <Button variant="minimal" size="small" icon="arrow-left" onClick={onClose} />
        <Icon icon="code" size={14} className="text-violet-500" />
        <span className="cr-title">{repo.name}</span>
        <Tag minimal className="!text-[9px]">{repo.kind}</Tag>
        <Tabs id="cr-tabs" selectedTabId={tab} onChange={(t) => { setTab(String(t)) }}
          className="ml-4">
          <Tab id="code" title="Code" />
          <Tab id="branches" title="Branches" />
          <Tab id="pulls" title={`Pull requests ${String(openPrs.length)}`} />
          <Tab id="checks" title="Checks" />
          <Tab id="settings" title="Settings" />
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === 'code' && (
          <CodeTab repo={repo} contents={contents} branchId={branch?.id ?? null}
            onPickBranch={setBranchId} />
        )}
        {tab === 'branches' && <BranchesTab repo={repo} contents={contents} />}
        {tab === 'pulls' && <PullRequestsTab repo={repo} contents={contents} />}
        {tab === 'checks' && <ChecksTab contents={contents} branchId={branch?.id ?? null}
          onPickBranch={setBranchId} />}
        {tab === 'settings' && <SettingsTab repo={repo} contents={contents} />}
      </div>
    </div>
  )
}

/** The Code tab: branch dropdown, the action row, the Files tree, the editor. */
function CodeTab({ repo, contents, branchId, onPickBranch }: {
  repo: CodeRepository
  contents: RepositoryContents
  branchId: string | null
  onPickBranch: (id: string) => void
}) {
  const save = useSaveFile(repo.id)
  const commit = useCommit(repo.id)
  const propose = useProposeChanges(repo.id)
  const publish = usePublishBranch(repo.id)
  const [path, setPath] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newPath, setNewPath] = useState('')
  const branch = contents.branches.find((b) => b.id === branchId) ?? null
  const files = contents.files.filter((f) => f.branchId === branchId)
  const file = files.find((f) => f.path === path) ?? null
  const target = contents.branches.find((b) => b.name === repo.defaultBranch) ?? null
  const lastCommit = contents.commits.find((c) => c.branchId === branchId) ?? null

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="cr-actionrow">
        <HTMLSelect value={branchId ?? ''} onChange={(e) => { onPickBranch(e.currentTarget.value) }}>
          {contents.branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}{b.protected ? ' (protected)' : ''}</option>
          ))}
        </HTMLSelect>
        <span className="ml-auto flex items-center gap-1">
          <Button size="small" variant="minimal" icon="play" disabled title="Not built here">Preview</Button>
          <Button size="small" variant="minimal" icon="lab-test" disabled title="Not built here">Test</Button>
          <Button size="small" variant="minimal" icon="git-commit"
            disabled={branch?.protected !== false}
            loading={commit.isPending}
            onClick={() => {
              commit.mutate({ branchId: branchId ?? '', message: `Update ${path ?? 'files'}`,
                parentId: lastCommit?.id ?? null })
            }}>Commit</Button>
          {/* Foundry's Build button runs the publish process, which is what
              makes code take effect; ours derives the job specs and records
              the check under Foundry's own name for it. */}
          <Button size="small" variant="minimal" icon="build"
            disabled={branchId === null} loading={publish.isPending}
            title="Derive a job spec from every SQL transform on this branch"
            onClick={() => { publish.mutate(branchId ?? '') }}>Publish</Button>
          <Button size="small" variant="minimal" icon="git-pull"
            disabled={branch === null || branch.protected || target === null}
            loading={propose.isPending}
            onClick={() => {
              propose.mutate({ sourceBranchId: branchId ?? '', targetBranchId: target?.id ?? '',
                title: `Changes from ${branch?.name ?? ''}` })
            }}>Propose changes</Button>
        </span>
      </div>

      {branch?.protected === true && (
        <Callout intent={Intent.WARNING} icon="lock" className="cr-callout">
          {branch.name} is protected and cannot be edited directly. Switch to a sandbox branch,
          or create one from the Branches tab.
        </Callout>
      )}

      <div className="flex-1 flex min-h-0">
        <div className="cr-files">
          <p className="cr-panel-head">Files</p>
          <ul>
            {files.map((f) => (
              <li key={f.id}
                className={`cr-file ${path === f.path ? 'cr-file-selected' : ''}`}
                onClick={() => { setPath(f.path); setDraft(f.content) }}>
                <Icon icon="document" size={11} className="text-muted-foreground" />
                {f.path}
              </li>
            ))}
          </ul>
          {branch?.protected === false && (
            <div className="cr-newfile">
              <InputGroup size="small" value={newPath} placeholder="src/new_file.py"
                onChange={(e) => { setNewPath(e.currentTarget.value) }} />
              <Button size="small" icon="add" disabled={newPath.trim() === ''}
                onClick={() => {
                  save.mutate({ branchId: branchId ?? '', path: newPath.trim(), content: '' },
                    { onSuccess: () => { setPath(newPath.trim()); setDraft(''); setNewPath('') } })
                }} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          {file === null ? (
            <NonIdealState icon="document" title="No file selected"
              description="Pick a file from the tree." />
          ) : (
            <>
              <div className="cr-editor-head">
                <span className="font-mono text-xs">{file.path}</span>
                {branch?.protected === false && (
                  <Button size="small" intent={Intent.PRIMARY} icon="floppy-disk"
                    className="ml-auto" loading={save.isPending}
                    disabled={draft === file.content}
                    onClick={() => {
                      save.mutate({ branchId: branchId ?? '', path: file.path, content: draft })
                    }}>Save</Button>
                )}
              </div>
              <TextArea fill className="cr-editor font-mono !text-xs" value={draft}
                readOnly={branch?.protected !== false}
                onChange={(e) => { setDraft(e.currentTarget.value) }} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function BranchesTab({ repo, contents }: { repo: CodeRepository; contents: RepositoryContents }) {
  const createBranch = useCreateBranch(repo.id)
  const createTag = useCreateTag(repo.id)
  const [name, setName] = useState('')
  const [tagName, setTagName] = useState('')
  const [tagCommit, setTagCommit] = useState('')

  return (
    <div className="p-4 max-w-3xl space-y-4">
      <Card compact className="!p-0">
        <div className="cr-panel-head-row">
          <span className="cr-label">Branches</span>
          <div className="ml-auto flex gap-1">
            <InputGroup size="small" value={name} placeholder="feature/my-change"
              onChange={(e) => { setName(e.currentTarget.value) }} />
            <Button size="small" icon="git-branch" loading={createBranch.isPending}
              disabled={name.trim() === ''}
              onClick={() => {
                createBranch.mutate(name.trim(), { onSuccess: () => { setName('') } })
              }}>New branch</Button>
          </div>
        </div>
        <ul className="divide-y divide-border/30">
          {contents.branches.map((b) => {
            const checks = contents.checks.filter((c) => c.branchId === b.id)
            const pr = contents.pullRequests.find((p) => p.sourceBranchId === b.id)
            const failed = checks.some((c) => c.status === 'failed')
            return (
              <li key={b.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <Icon icon="git-branch" size={11} className="text-muted-foreground" />
                <span className="font-mono flex-1 truncate">{b.name}</span>
                {b.protected && <Tag minimal icon="lock" className="!text-[9px]">protected</Tag>}
                {checks.length > 0 && (
                  <Tag minimal intent={failed ? Intent.DANGER : Intent.SUCCESS} className="!text-[9px]">
                    {failed ? 'checks failed' : 'checks passed'}
                  </Tag>
                )}
                {pr && <Tag minimal className="!text-[9px]">{pr.status}</Tag>}
              </li>
            )
          })}
        </ul>
      </Card>

      <Card compact className="!p-0">
        <div className="cr-panel-head-row">
          <span className="cr-label">Tags</span>
          <span className="cr-hint ml-2">Like immutable branches — a tag does not move once created.</span>
        </div>
        <ul className="divide-y divide-border/30">
          {contents.tags.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <Icon icon="tag" size={11} className="text-muted-foreground" />
              <span className="font-mono flex-1">{t.name}</span>
              <span className="text-muted-foreground font-mono">{t.commitId.slice(0, 8)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2 px-3 py-2">
          <InputGroup size="small" value={tagName} placeholder="1.0.0"
            onChange={(e) => { setTagName(e.currentTarget.value) }} />
          <HTMLSelect value={tagCommit} onChange={(e) => { setTagCommit(e.currentTarget.value) }}>
            <option value="">from commit…</option>
            {contents.commits.map((c) => (
              <option key={c.id} value={c.id}>{c.message.slice(0, 40)}</option>
            ))}
          </HTMLSelect>
          <Button size="small" icon="add" loading={createTag.isPending}
            disabled={tagName.trim() === '' || tagCommit === ''}
            onClick={() => {
              createTag.mutate({ name: tagName.trim(), commitId: tagCommit },
                { onSuccess: () => { setTagName(''); setTagCommit('') } })
            }} />
        </div>
      </Card>
    </div>
  )
}

function PullRequestsTab({ repo, contents }: { repo: CodeRepository; contents: RepositoryContents }) {
  const [filter, setFilter] = useState<'open' | 'closed'>('open')
  const shown = contents.pullRequests.filter((p) =>
    filter === 'open' ? p.status === 'open' : p.status !== 'open')
  return (
    <div className="p-4 max-w-3xl space-y-3">
      <div className="flex items-center gap-1">
        <Button size="small" variant={filter === 'open' ? undefined : 'minimal'}
          onClick={() => { setFilter('open') }}>Open</Button>
        <Button size="small" variant={filter === 'closed' ? undefined : 'minimal'}
          onClick={() => { setFilter('closed') }}>Closed</Button>
      </div>
      {shown.length === 0 ? (
        <p className="cr-hint">No {filter} pull requests.</p>
      ) : (
        shown.map((p) => <PullRequestCard key={p.id} repo={repo} contents={contents} pr={p} />)
      )}
    </div>
  )
}

function PullRequestCard({ repo, contents, pr }: {
  repo: CodeRepository; contents: RepositoryContents; pr: PullRequest
}) {
  const { data: blockers = [] } = usePullRequestBlockers(pr.status === 'open' ? pr.id : null)
  const review = useReview(repo.id)
  const merge = useMerge(repo.id)
  const [mode, setMode] = useState(repo.mergeModes[0] ?? 'squash_and_merge')
  const source = contents.branches.find((b) => b.id === pr.sourceBranchId)
  const target = contents.branches.find((b) => b.id === pr.targetBranchId)
  const reviews = contents.reviews.filter((r) => r.pullRequestId === pr.id)

  return (
    <Card compact className="!p-0">
      <div className="cr-panel-head-row">
        <Icon icon="git-pull" size={12} className="text-violet-500" />
        <span className="text-sm font-semibold">{pr.title}</span>
        <Tag minimal className="!text-[9px]">{pr.status}</Tag>
        <span className="cr-hint ml-2 font-mono">
          {source?.name} → {target?.name}
        </span>
      </div>
      <div className="px-3 py-2 space-y-2">
        {reviews.length > 0 && (
          <ul>
            {reviews.map((r) => (
              <li key={r.id} className="text-xs flex items-center gap-2">
                <Tag minimal intent={r.decision === 'approved' ? Intent.SUCCESS : Intent.DANGER}
                  className="!text-[9px]">{r.decision}</Tag>
                <span className="text-muted-foreground truncate">{r.comment}</span>
              </li>
            ))}
          </ul>
        )}
        {pr.status === 'open' && (
          <>
            {blockers.length > 0 && (
              <Callout intent={Intent.WARNING} icon="issue" className="!text-xs">
                {(blockers as { reason: string }[]).map((b, i) => <div key={i}>{b.reason}</div>)}
              </Callout>
            )}
            <div className="flex flex-wrap items-center gap-1">
              <Button size="small" variant="minimal" intent={Intent.SUCCESS} icon="tick"
                loading={review.isPending}
                onClick={() => {
                  review.mutate({ pullRequestId: pr.id, decision: 'approved', comment: '' })
                }}>Approve</Button>
              <Button size="small" variant="minimal" intent={Intent.DANGER} icon="cross"
                loading={review.isPending}
                onClick={() => {
                  review.mutate({ pullRequestId: pr.id, decision: 'rejected', comment: '' })
                }}>Reject</Button>
              <span className="ml-auto flex items-center gap-1">
                {repo.mergeModes.length > 1 && (
                  <HTMLSelect minimal value={mode}
                    onChange={(e) => { setMode(e.currentTarget.value) }}>
                    {repo.mergeModes.map((m) => (
                      <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                    ))}
                  </HTMLSelect>
                )}
                <Button size="small" intent={Intent.PRIMARY} icon="git-merge"
                  disabled={blockers.length > 0} loading={merge.isPending}
                  onClick={() => { merge.mutate({ prId: pr.id, mode }) }}>Merge</Button>
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

function ChecksTab({ contents, branchId, onPickBranch }: {
  contents: RepositoryContents
  branchId: string | null
  onPickBranch: (id: string) => void
}) {
  const checks = contents.checks.filter((c) => c.branchId === branchId)
  return (
    <div className="p-4 max-w-3xl space-y-3">
      <HTMLSelect value={branchId ?? ''} onChange={(e) => { onPickBranch(e.currentTarget.value) }}>
        {contents.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </HTMLSelect>
      {checks.length === 0 ? (
        <p className="cr-hint">No checks have run on this branch.</p>
      ) : (
        <Card compact className="!p-0">
          <ul className="divide-y divide-border/30">
            {checks.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <Tag minimal className="!text-[9px]"
                  intent={c.status === 'failed' ? Intent.DANGER
                    : c.status === 'succeeded' ? Intent.SUCCESS : Intent.WARNING}>
                  {c.status}
                </Tag>
                <span className="font-mono flex-1">{c.name}</span>
                <span className="text-muted-foreground truncate">{c.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

/** "Most options in the Settings tab are aimed for administrators" — branch
 *  protection is the part with an engine; the rest is recorded. */
function SettingsTab({ repo, contents }: { repo: CodeRepository; contents: RepositoryContents }) {
  return (
    <div className="p-4 max-w-3xl space-y-4">
      <Card compact>
        <p className="cr-label">Default branch</p>
        <p className="text-xs font-mono">{repo.defaultBranch}</p>
      </Card>
      <Card compact>
        <p className="cr-label">Merge modes offered</p>
        <div className="flex gap-1 mt-1">
          {repo.mergeModes.map((m) => (
            <Tag key={m} minimal className="!text-[9px]">{m.replace(/_/g, ' ')}</Tag>
          ))}
        </div>
      </Card>
      <Card compact className="!p-0">
        <div className="cr-panel-head-row"><span className="cr-label">Branch protection</span></div>
        <ul className="divide-y divide-border/30">
          {contents.branches.filter((b) => b.protected).map((b) => (
            <li key={b.id} className="px-3 py-2 text-xs">
              <p className="font-mono font-semibold">{b.name}</p>
              <ul className="cr-requirements">
                {b.requireCodeReviews > 0 && <li>Requires {b.requireCodeReviews} approving review(s)</li>}
                {b.requiredReviewerIds.length > 0 && <li>Requires specific reviewers</li>}
                {b.requirePublishCheck && <li>Requires the publish check to succeed</li>}
                {b.requireSecurityApproval && (
                  <li>Requires security approval — nothing here can grant it yet</li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      </Card>
      <p className="cr-hint">
        The rest of the Settings tab — editor preferences, upgrades, artifact settings — is not
        built here.
      </p>
    </div>
  )
}
