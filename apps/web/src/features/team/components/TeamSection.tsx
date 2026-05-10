// Layer: Mind (team management — hotel/chain scope)
//
// Blueprint migration of the SettingsPage Team section. This is a full port,
// not a token-swap: every shadcn/Radix primitive has been replaced with its
// Blueprint counterpart, and every lucide icon with its @blueprintjs/icons
// equivalent. Anatomy (Foundry Object View convention):
//
//   header  (title + member count + view toggle + Invite action)
//   body    (member table OR role matrix + role cards)
//
// The header view toggle is a Blueprint SegmentedControl, the member listing
// uses HTMLTable (compact, striped, interactive), the invite flow is a
// Blueprint Dialog, role chips are Tags with intent, and the destructive
// "remove member" confirmation is a Blueprint Alert (intent=danger).

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Alert,
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  HTMLSelect,
  HTMLTable,
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
import { useAuthStore } from '@/stores/auth.store'
import { hasPermission } from '@beacon/types'
import type { UserRole } from '@beacon/types'
import type { TeamMember } from '@/features/team/api'
import {
  useTeamMembers,
  useInviteTeamMember,
  useUpdateMemberRole,
  useRemoveTeamMember,
} from '@/features/team/hooks'
import { useDateFormat } from '@/features/user/hooks'

// ── Role config ────────────────────────────────────────────────────────────
// Blueprint Intent drives badge colors. `icon` is a Blueprint icon name so it
// can be passed straight into <Tag icon={…}> and <NonIdealState icon={…}>.

interface RoleConfig {
  label: string
  icon: IconName
  intent: Intent
  description: string
  capabilities: string[]
  restrictions: string[]
}

const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  owner: {
    label: 'Owner',
    icon: 'crown',
    intent: Intent.WARNING,
    description: 'Full access to everything including billing and user management.',
    capabilities: ['All admin capabilities', 'Manage team members & roles', 'Hotel profile & billing', 'GDPR erasure', 'Delete hotel data'],
    restrictions: [],
  },
  admin: {
    label: 'Admin',
    icon: 'shield',
    intent: Intent.PRIMARY,
    description: 'Full operational access. Cannot manage users or billing.',
    capabilities: ['View & edit all inventory', 'Adjust stock & run stocktakes', 'Approve restocks', 'Manage categories & suppliers', 'View all reports & audit log'],
    restrictions: ['Cannot add or remove team members', 'Cannot change billing'],
  },
  team_member: {
    label: 'Team Member',
    icon: 'user',
    intent: Intent.SUCCESS,
    description: 'Day-to-day operational access. No admin capabilities.',
    capabilities: ['View inventory', 'Adjust stock', 'Run stocktakes', 'View dashboard & alerts', 'Scan QR codes'],
    restrictions: ['Cannot manage team', 'Cannot approve restocks', 'No reports access', 'No settings access'],
  },
  limited_access: {
    label: 'Limited Access',
    icon: 'endorsed',
    intent: Intent.NONE,
    description: 'Scan-first mobile role for floor staff. Minimal access, maximum security.',
    capabilities: ['Scan QR/barcodes', 'Adjust stock quantities', 'View item details'],
    restrictions: ['No inventory list', 'No reports or audit', 'No settings', 'No team management', 'No dashboard'],
  },
}

const ASSIGNABLE_ROLES: { value: Exclude<UserRole, 'owner'>; label: string }[] = [
  { value: 'admin',          label: 'Admin' },
  { value: 'team_member',    label: 'Team Member' },
  { value: 'limited_access', label: 'Limited Access' },
]

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

const ROLES_ORDER: UserRole[] = ['owner', 'admin', 'team_member', 'limited_access']

// ── Role matrix table ──────────────────────────────────────────────────────

function TeamRoleMatrix() {
  return (
    <HTMLTable compact striped bordered className="w-full">
      <thead>
        <tr>
          <th className="w-52">Capability</th>
          {ROLES_ORDER.map((role) => {
            const cfg = ROLE_CONFIG[role]
            return (
              <th key={role} className="text-center w-28">
                <div className="flex flex-col items-center gap-1">
                  <Tag icon={cfg.icon} intent={cfg.intent} minimal round>{cfg.label}</Tag>
                </div>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {MATRIX_ROWS.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            {ROLES_ORDER.map((role) => (
              <td key={role} className="text-center">
                {row[role]
                  ? <Tag icon="tick"  intent={Intent.SUCCESS} minimal round />
                  : <Tag icon="cross" intent={Intent.NONE}    minimal round />}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </HTMLTable>
  )
}

// ── Role description cards ────────────────────────────────────────────────

function TeamRoleCards() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {ROLES_ORDER.map((role) => {
        const cfg = ROLE_CONFIG[role]
        return (
          <Callout
            key={role}
            icon={cfg.icon}
            intent={cfg.intent}
            title={cfg.label}
            compact
          >
            <p className="text-xs leading-relaxed mb-2">{cfg.description}</p>
            <ul className="space-y-0.5">
              {cfg.capabilities.slice(0, 3).map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-xs">
                  <Tag icon="tick" intent={Intent.SUCCESS} minimal round /> {c}
                </li>
              ))}
              {cfg.restrictions[0] && (
                <li className="flex items-start gap-1.5 text-xs">
                  <Tag icon="cross" intent={Intent.DANGER} minimal round /> {cfg.restrictions[0]}
                </li>
              )}
            </ul>
          </Callout>
        )
      })}
    </div>
  )
}

// ── Invite modal ───────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.email('Enter a valid email'),
  role: z.enum(['admin', 'team_member', 'limited_access']),
})
type InviteFields = z.infer<typeof inviteSchema>

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invite = useInviteTeamMember()
  const { register, handleSubmit, reset, control, watch, formState: { errors, isSubmitting } } = useForm<InviteFields>({
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
    <Dialog
      isOpen={open}
      onClose={onClose}
      title="Invite Team Member"
      icon="new-person"
    >
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
        <DialogBody>
          <FormGroup
            label="Email address"
            labelFor="inv-email"
            intent={errors.email ? Intent.DANGER : Intent.NONE}
            helperText={errors.email?.message}
          >
            <InputGroup
              id="inv-email"
              type="email"
              placeholder="colleague@hotel.com"
              intent={errors.email ? Intent.DANGER : Intent.NONE}
              {...register('email')}
            />
          </FormGroup>

          <FormGroup label="Role" labelFor="inv-role">
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <HTMLSelect
                  id="inv-role"
                  fill
                  value={field.value}
                  onChange={(e) => { field.onChange(e.target.value) }}
                  options={ASSIGNABLE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
                />
              )}
            />
          </FormGroup>

          <Callout icon={roleInfo.icon} intent={roleInfo.intent} compact>
            {roleInfo.description}
          </Callout>
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button onClick={onClose} disabled={isSubmitting}>Cancel</Button>
              <Button
                type="submit"
                intent={Intent.PRIMARY}
                loading={isSubmitting}
                icon="send-message"
              >
                Send Invite
              </Button>
            </>
          }
        />
      </form>
    </Dialog>
  )
}

// ── Member row ────────────────────────────────────────────────────────────

function TeamMemberRow({ member, currentUserId, canManage }: {
  member: TeamMember
  currentUserId: string
  canManage: boolean
}) {
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveTeamMember()
  const fmtDate = useDateFormat()
  const isSelf = member.id === currentUserId
  const cfg = ROLE_CONFIG[member.role]
  const [confirmRemove, setConfirmRemove] = useState(false)

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
                <p className="text-xs">{cfg.description}</p>
              </div>
            }
            placement="right"
          >
            <Tag icon={cfg.icon} intent={cfg.intent} minimal interactive>
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
              />
              <Button
                icon="trash"
                variant="minimal"
                intent={Intent.DANGER}
                onClick={() => { setConfirmRemove(true) }}
                disabled={removeMember.isPending}
                aria-label="Remove member"
              />
            </div>
          )}
        </td>
      </tr>
      <Alert
        isOpen={confirmRemove}
        intent={Intent.DANGER}
        icon="trash"
        cancelButtonText="Cancel"
        confirmButtonText="Remove"
        onCancel={() => { setConfirmRemove(false) }}
        onConfirm={() => {
          removeMember.mutate(member.id)
          setConfirmRemove(false)
        }}
      >
        <p className="font-semibold mb-1">Remove team member?</p>
        <p className="text-sm">
          Remove <strong>{member.email}</strong> from the team? They will lose access
          immediately.
        </p>
      </Alert>
    </>
  )
}

// ── Section root ──────────────────────────────────────────────────────────

type TeamView = 'members' | 'roles'

export function TeamSection() {
  const { data: members = [], isLoading } = useTeamMembers()
  const role = useAuthStore((s) => s.role)
  const userId = useAuthStore((s) => s.session?.user.id ?? '')
  const canManage = !!role && hasPermission(role, 'can_manage_users')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [view, setView] = useState<TeamView>('members')

  const ownerCount   = members.filter((m) => m.role === 'owner').length
  const adminCount   = members.filter((m) => m.role === 'admin').length
  const memberCount  = members.filter((m) => m.role === 'team_member').length
  const limitedCount = members.filter((m) => m.role === 'limited_access').length

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold">Team</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {members.length} member{members.length !== 1 ? 's' : ''}{' '}
            {[
              ownerCount   > 0 && `· ${String(ownerCount)} owner`,
              adminCount   > 0 && `· ${String(adminCount)} admin`,
              memberCount  > 0 && `· ${String(memberCount)} team member`,
              limitedCount > 0 && `· ${String(limitedCount)} limited`,
            ].filter(Boolean).join(' ')}
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
            <Button
              intent={Intent.PRIMARY}
              icon="plus"
              onClick={() => { setInviteOpen(true) }}
            >
              Invite Member
            </Button>
          )}
        </div>
      </div>

      {view === 'roles' ? (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold">Role Descriptions</h3>
              <Tag icon="info-sign" minimal round />
            </div>
            <TeamRoleCards />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Permission Matrix</h3>
            <TeamRoleMatrix />
          </div>
        </div>
      ) : isLoading ? (
        <div className="py-16 flex justify-center">
          <Spinner size={SpinnerSize.STANDARD} />
        </div>
      ) : members.length === 0 ? (
        <NonIdealState
          icon="people"
          title="No team members yet"
          description="Invite teammates to give them scoped access to this hotel."
          action={canManage ? (
            <Button
              icon="plus"
              intent={Intent.PRIMARY}
              onClick={() => { setInviteOpen(true) }}
            >
              Invite your first member
            </Button>
          ) : undefined}
        />
      ) : (
        <HTMLTable interactive striped className="w-full">
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
              <TeamMemberRow key={m.id} member={m} currentUserId={userId} canManage={canManage} />
            ))}
          </tbody>
        </HTMLTable>
      )}

      <InviteModal open={inviteOpen} onClose={() => { setInviteOpen(false) }} />
    </div>
  )
}
