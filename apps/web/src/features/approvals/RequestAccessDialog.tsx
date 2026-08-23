// The Request-access pop-up, the wizard's grammar condensed to one dialog:
// the capture's auto-title, a justification, then the page's composition rule
// — a group with a role on the project when any exists, a direct role when
// none do — plus a marking task for each project marking the caller lacks:
// "all changes required to give the user access", including Markings.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Dialog, DialogBody, DialogFooter, HTMLSelect, InputGroup, Radio,
  RadioGroup, Spinner, Tag, TextArea,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import {
  useProjectAccessOptions, useFileAccessRequest, type AccessRequestTask,
} from './api'

const DIRECT_ROLES = ['viewer', 'editor', 'owner', 'discoverer'] as const

export function RequestAccessDialog({ projectId, projectName, isOpen, onClose }: {
  projectId: string
  projectName: string
  isOpen: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.userId)
  const { data: options } = useProjectAccessOptions(isOpen ? projectId : null)
  const file = useFileAccessRequest()
  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [role, setRole] = useState<string>('viewer')

  useEffect(() => {
    if (isOpen) { setTitle(`Access request to "${projectName}"`); setWhy(''); setGroupId(null) }
  }, [isOpen, projectName])

  const groups = options?.groups ?? []
  const lacking = (options?.markings ?? []).filter((m) => !m.member)

  const submit = () => {
    if (userId === null) return
    const tasks: AccessRequestTask[] = []
    if (groups.length > 0) {
      const chosen = groupId ?? groups[0].id
      tasks.push({ kind: 'group_membership', payload: { user: userId, group: chosen } })
    } else {
      tasks.push({ kind: 'project_role', payload: { user: userId, project: projectId, role } })
    }
    for (const m of lacking) {
      tasks.push({ kind: 'marking_member', payload: { user: userId, marking: m.id } })
    }
    file.mutate({ title, justification: why, tasks }, {
      onSuccess: (id) => {
        onClose()
        toast.success('Successfully submitted access request.', {
          action: { label: 'View details', onClick: () => { void navigate(`/approvals/${id}`) } },
        })
      },
    })
  }

  return (
    <Dialog isOpen={isOpen} title="Request access" icon="unlock" onClose={onClose}>
      <DialogBody>
        {options === undefined ? <Spinner /> : (
          <div className="request-access-body">
            <label className="request-access-label">Request name</label>
            <InputGroup value={title} onChange={(e) => { setTitle(e.target.value) }} />
            <label className="request-access-label">Reason for access</label>
            <TextArea fill value={why} placeholder="Why do you need access?"
              onChange={(e) => { setWhy(e.target.value) }} />
            {groups.length > 0 ? (
              <>
                <label className="request-access-label">Join a group with a role on this project</label>
                <RadioGroup selectedValue={groupId ?? groups[0].id}
                  onChange={(e) => { setGroupId(e.currentTarget.value) }}>
                  {groups.map((g) => (
                    <Radio key={g.id} value={g.id} labelElement={
                      <span>{g.name} <Tag minimal>{g.role}</Tag></span>
                    } />
                  ))}
                </RadioGroup>
              </>
            ) : (
              <>
                <label className="request-access-label">
                  No groups hold a role here — request a role directly
                </label>
                <HTMLSelect value={role} options={[...DIRECT_ROLES]}
                  onChange={(e) => { setRole(e.target.value) }} />
              </>
            )}
            {lacking.length > 0 && (
              <p className="request-access-markings">
                Includes marking access:{' '}
                {lacking.map((m) => <Tag key={m.id} minimal icon="shield">{m.name}</Tag>)}
              </p>
            )}
          </div>
        )}
      </DialogBody>
      <DialogFooter actions={
        <Button intent="primary" text="Submit request"
          disabled={file.isPending || title.trim() === '' || why.trim() === ''}
          onClick={submit} />
      } />
    </Dialog>
  )
}
