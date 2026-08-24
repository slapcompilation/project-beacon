// Control Panel, opening on its one extension: Authentication. The editor
// draws the captures' grammar — a rule row reads "If user's [attribute]
// [match kind] [regex] → [group]", rules group under the provider, the org
// rules are numbered and ordered ("the first rule they match" wins), and the
// Test panel simulates a user without writing.
import { useState } from 'react'
import {
  Button, Card, HTMLSelect, Icon, InputGroup, NonIdealState, Spinner, Switch,
  Tab, Tabs, Tag,
} from '@blueprintjs/core'
import {
  useProvider, useGroupRules, useRuleBasedGroups, useOrgRules,
  useOrganizationsList, useOrgUsers, useAddGroupRule, useDeleteGroupRule,
  useUpdateProvider, useAddOrgRule, useDeleteOrgRule, useSwapOrgRules,
  useTestAssignment, MATCH_KIND_LABEL,
  type MatchKind, type Provider, type TestResult,
} from '@/features/controlPanel/api'

const ATTRIBUTES = ['email']
const KINDS = Object.keys(MATCH_KIND_LABEL) as MatchKind[]

export default function ControlPanelPage() {
  const { data: provider, isLoading } = useProvider()

  return (
    <div className="cpanel-page">
      <h2 className="cpanel-title">Control Panel</h2>
      <p className="cpanel-sub">Authentication — rules evaluated at login, per provider.</p>
      {isLoading ? <Spinner /> : provider === null || provider === undefined ? (
        <NonIdealState icon="lock" title="Not visible"
          description="Authentication configuration is for organization administrators." />
      ) : (
        <>
          <div className="cpanel-provider">
            <Icon icon="id-number" />
            <span className="cpanel-provider-name">{provider.name}</span>
            <Tag minimal>{provider.kind}</Tag>
            <Tag minimal icon="globe-network">{provider.realm}</Tag>
          </div>
          <Tabs id="cpanel" size="large" renderActiveTabPanelOnly>
            <Tab id="groups" title="Group assignment" panel={<GroupAssignment provider={provider} />} />
            <Tab id="orgs" title="Organization assignment" panel={<OrgAssignment provider={provider} />} />
          </Tabs>
        </>
      )}
    </div>
  )
}

function GroupAssignment({ provider }: { provider: Provider }) {
  const { data: rules = [] } = useGroupRules(provider.id)
  const { data: groups = [] } = useRuleBasedGroups()
  const { data: users = [] } = useOrgUsers()
  const addRule = useAddGroupRule()
  const removeRule = useDeleteGroupRule()
  const test = useTestAssignment()
  const [groupId, setGroupId] = useState('')
  const [attribute, setAttribute] = useState('email')
  const [kind, setKind] = useState<MatchKind>('includes')
  const [pattern, setPattern] = useState('')
  const [testUser, setTestUser] = useState('')
  const [results, setResults] = useState<TestResult[] | null>(null)

  return (
    <div className="cpanel-columns">
      <div className="cpanel-main">
        <Card>
          <h3>Rule-based group assignment rules</h3>
          <p className="cpanel-hint">
            Applied at login, never retroactively. All conditions of a rule must match;
            a second rule to the same group is an OR.
          </p>
          {rules.length === 0 && <p className="cpanel-hint">No rules yet.</p>}
          {rules.map((r, i) => (
            <div key={r.id} className="cpanel-rule">
              <span className="cpanel-rule-n">{i + 1}</span>
              <span className="cpanel-rule-body">
                {r.conditions.map((c) => (
                  <span key={c.id} className="cpanel-cond">
                    If user&apos;s <Tag minimal>{c.attribute}</Tag>{' '}
                    {MATCH_KIND_LABEL[c.match_kind]} <Tag minimal intent="success">{c.pattern}</Tag>
                  </span>
                ))}
              </span>
              <Icon icon="arrow-right" />
              <Tag icon="people" minimal>{r.group_name}</Tag>
              <Button variant="minimal" icon="cross" aria-label="Remove rule"
                onClick={() => { removeRule.mutate({ ruleId: r.id }) }} />
            </div>
          ))}
          <div className="cpanel-add">
            <span>If user&apos;s</span>
            <HTMLSelect value={attribute} options={ATTRIBUTES}
              onChange={(e) => { setAttribute(e.target.value) }} />
            <HTMLSelect value={kind}
              options={KINDS.map((k) => ({ value: k, label: MATCH_KIND_LABEL[k] }))}
              onChange={(e) => { setKind(e.target.value as MatchKind) }} />
            <InputGroup placeholder="Enter a regular expression…" value={pattern}
              onChange={(e) => { setPattern(e.target.value) }} />
            <Icon icon="arrow-right" />
            <HTMLSelect value={groupId}
              options={[{ value: '', label: 'Select group…' },
                ...groups.map((g) => ({ value: g.id, label: g.name }))]}
              onChange={(e) => { setGroupId(e.target.value) }} />
            <Button intent="primary" icon="add" text="Add rule"
              disabled={groupId === '' || pattern === '' || addRule.isPending}
              onClick={() => {
                addRule.mutate({ providerId: provider.id, groupId,
                  conditions: [{ attribute, match_kind: kind, pattern }] })
                setPattern('')
              }} />
          </div>
          {groups.length === 0 && (
            <p className="cpanel-hint">
              No rule-based groups exist yet — create a group with type rule_based first.
            </p>
          )}
        </Card>
      </div>
      <Card className="cpanel-test">
        <h3>Test group assignment rules</h3>
        <p className="cpanel-hint">
          Select a test user to see how the configured rules impact group assignment. Nothing is written.
        </p>
        <HTMLSelect fill value={testUser}
          options={[{ value: '', label: 'Test user…' },
            ...users.map((u) => ({ value: u.id, label: u.email }))]}
          onChange={(e) => { setTestUser(e.target.value) }} />
        <Button icon="play" text="Test rules" disabled={testUser === '' || test.isPending}
          onClick={() => {
            test.mutate({ userId: testUser }, { onSuccess: (r) => { setResults(r) } })
          }} />
        {results !== null && (
          <div className="cpanel-test-results">
            {results.length === 0 && <p className="cpanel-hint">No rules configured.</p>}
            {results.map((r) => (
              <div key={r.rule} className="cpanel-test-row">
                <Icon icon={r.matched ? 'tick-circle' : 'circle'}
                  intent={r.matched ? 'success' : 'none'} />
                <span>{r.group}</span>
                <Tag minimal intent={r.matched ? 'success' : 'none'}>
                  {r.matched ? 'matched' : 'no match'}
                </Tag>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function OrgAssignment({ provider }: { provider: Provider }) {
  const { data: rules = [] } = useOrgRules(provider.id)
  const { data: orgs = [] } = useOrganizationsList()
  const update = useUpdateProvider()
  const addRule = useAddOrgRule()
  const removeRule = useDeleteOrgRule()
  const swap = useSwapOrgRules()
  const [attribute, setAttribute] = useState('email')
  const [kind, setKind] = useState<MatchKind>('includes')
  const [pattern, setPattern] = useState('')
  const [orgId, setOrgId] = useState('')

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? id

  return (
    <Card>
      <h3>Organization assignment rules</h3>
      <p className="cpanel-hint">
        Applied in order at login — people are assigned to the organization in the first rule they match.
      </p>
      <Switch checked={provider.org_assignment_enabled}
        label="Assign the primary organization at login"
        onChange={(e) => {
          update.mutate({ providerId: provider.id, enabled: e.currentTarget.checked,
            defaultOrganizationId: provider.default_organization_id })
        }} />
      {rules.map((r, i) => (
        <div key={r.id} className="cpanel-rule">
          <span className="cpanel-rule-n">{i + 1}</span>
          <span className="cpanel-rule-body">
            <span className="cpanel-cond">
              If user&apos;s <Tag minimal>{r.attribute}</Tag>{' '}
              {MATCH_KIND_LABEL[r.match_kind]} <Tag minimal intent="success">{r.pattern}</Tag>
            </span>
          </span>
          <Icon icon="arrow-right" />
          <Tag icon="office" minimal>{orgName(r.organization_id)}</Tag>
          <Button variant="minimal" icon="arrow-up" aria-label="Move up" disabled={i === 0}
            onClick={() => { swap.mutate({ a: rules[i], b: rules[i - 1] }) }} />
          <Button variant="minimal" icon="arrow-down" aria-label="Move down"
            disabled={i === rules.length - 1}
            onClick={() => { swap.mutate({ a: rules[i], b: rules[i + 1] }) }} />
          <Button variant="minimal" icon="cross" aria-label="Remove rule"
            onClick={() => { removeRule.mutate({ ruleId: r.id }) }} />
        </div>
      ))}
      <div className="cpanel-add">
        <span>If user&apos;s</span>
        <HTMLSelect value={attribute} options={ATTRIBUTES}
          onChange={(e) => { setAttribute(e.target.value) }} />
        <HTMLSelect value={kind}
          options={KINDS.map((k) => ({ value: k, label: MATCH_KIND_LABEL[k] }))}
          onChange={(e) => { setKind(e.target.value as MatchKind) }} />
        <InputGroup placeholder="Enter a regular expression…" value={pattern}
          onChange={(e) => { setPattern(e.target.value) }} />
        <Icon icon="arrow-right" />
        <HTMLSelect value={orgId}
          options={[{ value: '', label: 'Select organization…' },
            ...orgs.map((o) => ({ value: o.id, label: o.name }))]}
          onChange={(e) => { setOrgId(e.target.value) }} />
        <Button intent="primary" icon="add" text="Add rule"
          disabled={orgId === '' || pattern === '' || addRule.isPending}
          onClick={() => {
            addRule.mutate({ providerId: provider.id,
              position: (rules[rules.length - 1]?.position ?? -1) + 1,
              attribute, match_kind: kind, pattern, organizationId: orgId })
            setPattern('')
          }} />
      </div>
      <div className="cpanel-default">
        <span>Default organization — if a user does not match any of the rules above</span>
        <Icon icon="arrow-right" />
        <HTMLSelect value={provider.default_organization_id ?? ''}
          options={[{ value: '', label: 'No organization' },
            ...orgs.map((o) => ({ value: o.id, label: o.name }))]}
          onChange={(e) => {
            update.mutate({ providerId: provider.id,
              enabled: provider.org_assignment_enabled,
              defaultOrganizationId: e.target.value === '' ? null : e.target.value })
          }} />
      </div>
      {provider.org_assignment_enabled && provider.default_organization_id === null && (
        <p className="cpanel-warning">
          <Icon icon="warning-sign" intent="warning" /> Since no organization is set,
          login will fail for users who do not match any rules.
        </p>
      )}
    </Card>
  )
}
