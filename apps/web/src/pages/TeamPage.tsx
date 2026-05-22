// Layer: Mind — team governance, role permissions, access control
// Palantir principle: operators must understand who can do what. Role matrix is a
// first-class feature, not buried in a help article.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  HTMLSelect,
  HTMLTable,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
  Tag,
  Tooltip,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { hasPermission } from '@beacon/types'
import {
  useTeamMembers,
  useInviteTeamMember,
  useUpdateMemberRole,
  useRemoveTeamMember,
} from '@/features/team/hooks'
import { useDateFormat } from '@/features/user/hooks'
import type { UserRole } from '@beacon/types'
import type { TeamMember } from '@/features/team/api'

// ─── Role config ──────────────────────────────────────────────────────────────

interface RoleConfig {
  label: string
  icon: IconName
  color: string
  badgeClass: string
  description: string
  capabilities: string[]
  restrictions: string[]
}

const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  owner: {
    label: 'Owner',
    icon: 'crown',
    color: 'text-purple-700',
    badgeClass: 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
    description: 'Full access to everything including billing and user management.',
    capabilities: ['All admin capabilities', 'Manage team members & roles', 'Hotel profile & billing', 'GDPR erasure', 'Delete hotel data'],
    restrictions: [],
  },
  admin: {
    label: 'Admin',
    icon: 'shield',
    color: 'text-blue-700',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    description: 'Full operational access. Cannot manage users or billing.',
    capabilities: ['View & edit all inventory', 'Adjust stock & run stocktakes', 'Approve restocks', 'Manage categories & suppliers', 'View all reports & audit log'],
    restrictions: ['Cannot add or remove team members', 'Cannot change billing'],
  },
  team_member: {
    label: 'Team Member',
    icon: 'user',
    color: 'text-green-700',
    badgeClass: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300',
    description: 'Day-to-day operational access. No admin capabilities.',
    capabilities: ['View inventory', 'Adjust stock', 'Run stocktakes', 'View dashboard & alerts', 'Scan QR codes'],
    restrictions: ['Cannot manage team', 'Cannot approve restocks', 'No reports access', 'No settings access'],
  },
  limited_access: {
    label: 'Limited Access',
    icon: 'id-number',
    color: 'text-slate-600',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
    description: 'Scan-first mobile role for floor staff. Minimal access, maximum security.',
    capabilities: ['Scan QR/barcodes', 'Adjust stock quantities', 'View item details'],
    restrictions: ['No inventory list', 'No reports or audit', 'No settings', 'No team management', 'No dashboard'],
  },
}

const ASSIGNABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'team_member', label: 'Team Member' },
  { value: 'limited_access', label: 'Limited Access' },
]

// ─── Role capabilities matrix ─────────────────────────────────────────────────

const MATRIX_ROWS: { label: string; owner: boolean; admin: boolean; team_member: boolean; limited_access: boolean }[] = [
  { label: 'View inventory',          owner: true,  admin: true,  team_member: true,  limited_access: true  },
  { label: 'Adjust stock / scan',     owner: true,  admin: true,  team_member: true,  limited_access: true  },
  { label: 'Run stocktake',           owner: true,  admin: true,  team_member: true,  limited_access: false },
  { label: 'Add / edit products',     owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'Approve restocks',        owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'View reports',            owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'View audit log',          owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'Manage categories',       owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'Manage suppliers',        owner: true,  admin: true,  team_member: false, limited_access: false },
  { label: 'Manage team members',     owner: true,  admin: false, team_member: false, limited_access: false },
  { label: 'Hotel profile / billing', owner: true,  admin: false, team_member: false, limited_access: false },
  { label: 'GDPR erasure',            owner: true,  admin: false, team_member: false, limited_access: false },
]

function RoleMatrix() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <HTMLTable compact striped className="w-full">
        <thead>
          <tr>
            <th className="w-52">Capability</th>
            {(['owner', 'admin', 'team_member', 'limited_access'] as const).map((role) => {
              const cfg = ROLE_CONFIG[role]
              return (
                <th key={role} className="text-center w-28">
                  <div className="flex flex-col items-center gap-1">
                    <Icon icon={cfg.icon} size={12} className={cfg.color} />
                    <span className="text-xs">{cfg.label}</span>
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {MATRIX_ROWS.map((row) => (
            <tr key={row.label}>
              <td className="text-sm">{row.label}</td>
              {(['owner', 'admin', 'team_member', 'limited_access'] as const).map((role) => (
                <td key={role} className="text-center">
                  {row[role] ? (
                    <Icon icon="tick" size={12} className="text-green-600 mx-auto" />
                  ) : (
                    <Icon icon="cross" size={12} className="text-muted-foreground/40 mx-auto" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </HTMLTable>
    </div>
  )
}

// ─── Role card strip ──────────────────────────────────────────────────────────

function RoleCards() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {(Object.entries(ROLE_CONFIG) as [UserRole, RoleConfig][]).map(([role, cfg]) => (
        <div key={role} className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Icon icon={cfg.icon} size={14} className={cfg.color} />
            <span className="text-sm font-semibold">{cfg.label}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{cfg.description}</p>
          <ul className="space-y-0.5">
            {cfg.capabilities.slice(0, 3).map((c) => (
              <li key={c} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Icon icon="tick" size={12} className="text-green-500 mt-px flex-shrink-0" />
                {c}
              </li>
            ))}
            {cfg.restrictions[0] && (
              <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Icon icon="cross" size={12} className="text-red-400 mt-px flex-shrink-0" />
                {cfg.restrictions[0]}
              </li>
            )}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.email('Enter a valid email'),
  role: z.enum(['admin', 'team_member', 'limited_access']),
})
type InviteFields = z.infer<typeof inviteSchema>

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invite = useInviteTeamMember()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InviteFields>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'team_member' },
  })

  const selectedRole = watch('role')
  const roleInfo = ROLE_CONFIG[selectedRole]

  const onSubmit = async (data: InviteFields) => {
    await invite.mutateAsync(data)
    reset()
    onClose()
  }

  return (
    <Dialog isOpen={open} onClose={onClose} title="Invite Team Member" className="!w-[28rem]">
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
        <DialogBody className="space-y-4">
          <FormGroup label="Email address" labelFor="inv-email" intent={errors.email ? Intent.DANGER : Intent.NONE} helperText={errors.email?.message}>
            <InputGroup id="inv-email" type="email" placeholder="colleague@hotel.com" {...register('email')} intent={errors.email ? Intent.DANGER : Intent.NONE} />
          </FormGroup>

          <FormGroup label="Role">
            <HTMLSelect
              value={selectedRole}
              onChange={(e) => { setValue('role', e.target.value as InviteFields['role']) }}
              options={ASSIGNABLE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
              fill
            />
            <div className="rounded-md bg-muted/50 border px-3 py-2 flex gap-2 mt-2">
              <Icon icon={roleInfo.icon} size={12} className={cn('mt-px flex-shrink-0', roleInfo.color)} />
              <p className="text-xs text-muted-foreground leading-relaxed">{roleInfo.description}</p>
            </div>
          </FormGroup>
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button type="button" variant="minimal" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" intent={Intent.PRIMARY} loading={isSubmitting}>
                Send Invite
              </Button>
            </>
          }
        />
      </form>
    </Dialog>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  currentUserId,
  canManage,
}: {
  member: TeamMember
  currentUserId: string
  canManage: boolean
}) {
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveTeamMember()
  const fmtDate = useDateFormat()
  const isSelf = member.id === currentUserId
  const cfg = ROLE_CONFIG[member.role]

  const [confirmRemove, setConfirmRemove] = useState<{ id: string } | null>(null)

  return (
    <>
      <tr>
        <td>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase">
              {member.email[0]}
            </div>
            <div>
              <p className="text-sm font-medium">{member.email}</p>
              {isSelf && <p className="text-xs text-muted-foreground">You</p>}
            </div>
          </div>
        </td>
        <td>
          <Tooltip
            content={
              <div className="max-w-xs">
                <p className="text-xs font-medium mb-1">{cfg.label}</p>
                <p className="text-xs text-muted-foreground">{cfg.description}</p>
              </div>
            }
            placement="right"
          >
            <Tag minimal icon={cfg.icon} className={cn('cursor-help', cfg.badgeClass)}>
              {cfg.label}
            </Tag>
          </Tooltip>
        </td>
        <td className="text-sm text-muted-foreground">
          {fmtDate(new Date(member.created_at))}
        </td>
        <td className="text-right">
          {canManage && !isSelf && member.role !== 'owner' && (
            <div className="flex items-center justify-end gap-2">
              <HTMLSelect
                value={member.role}
                onChange={(e) => { updateRole.mutate({ userId: member.id, role: e.target.value }) }}
                disabled={updateRole.isPending}
                options={ASSIGNABLE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
                className="!h-8 !min-h-8"
              />
              <Button
                variant="minimal"
                size="small"
                intent={Intent.DANGER}
                icon="trash"
                loading={removeMember.isPending}
                onClick={() => { setConfirmRemove({ id: member.id }) }}
                aria-label="Remove member"
              />
            </div>
          )}
        </td>
      </tr>

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove team member?"
        description={`Remove ${member.email} from the team? They will lose access immediately.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => { removeMember.mutate(member.id) }}
        onCancel={() => { setConfirmRemove(null) }}
      />
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TeamView = 'members' | 'roles'

export default function TeamPage() {
  const { data: members = [], isLoading } = useTeamMembers()
  const role = useAuthStore((s) => s.role)
  const userId = useAuthStore((s) => s.session?.user.id ?? '')
  const canManage = !!role && hasPermission(role, 'can_manage_users')

  const [inviteOpen, setInviteOpen] = useState(false)
  const [view, setView] = useState<TeamView>('members')

  const ownerCount = members.filter((m) => m.role === 'owner').length
  const adminCount = members.filter((m) => m.role === 'admin').length
  const memberCount = members.filter((m) => m.role === 'team_member').length
  const limitedCount = members.filter((m) => m.role === 'limited_access').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold">Team</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? 's' : ''} ·{' '}
            {[
              ownerCount > 0 && `${String(ownerCount)} owner`,
              adminCount > 0 && `${String(adminCount)} admin`,
              memberCount > 0 && `${String(memberCount)} team member`,
              limitedCount > 0 && `${String(limitedCount)} limited`,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            size="small"
            value={view}
            onValueChange={(v) => { setView(v as TeamView) }}
            options={[
              { value: 'members', label: 'Members' },
              { value: 'roles',   label: 'Role Matrix' },
            ]}
          />
          {canManage && (
            <Button intent={Intent.PRIMARY} icon="plus" onClick={() => { setInviteOpen(true) }}>
              Invite Member
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {view === 'roles' ? (
          <>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold">Role Descriptions</h2>
                <Icon icon="info-sign" size={12} className="text-muted-foreground" />
              </div>
              <RoleCards />
            </div>
            <div>
              <h2 className="text-sm font-semibold mb-3">Permission Matrix</h2>
              <RoleMatrix />
            </div>
          </>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
          </div>
        ) : members.length === 0 ? (
          <NonIdealState
            icon="people"
            title="No team members yet"
            action={canManage ? (
              <Button variant="outlined" size="small" icon="plus" onClick={() => { setInviteOpen(true) }}>
                Invite your first member
              </Button>
            ) : undefined}
          />
        ) : (
          <HTMLTable compact striped className="w-full">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  currentUserId={userId}
                  canManage={canManage}
                />
              ))}
            </tbody>
          </HTMLTable>
        )}
      </div>

      <InviteModal open={inviteOpen} onClose={() => { setInviteOpen(false) }} />
    </div>
  )
}
