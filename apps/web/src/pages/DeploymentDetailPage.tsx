// Deployment detail — release pinned, runtime configuration, recent inference
// summary, lifecycle controls. Mirrors AIP folder 4 #15 ("Inside the
// deployment model — details screen").
//
// v1 scope: surface what we already know (release + status + resource profile
// + start time) plus a stub for the inference history dataset. Live logs +
// metric charts wait for a Supabase edge-function deployment counterpart.

import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button, Callout, Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { useDeployment, useRelease, useStopDeployment } from '@/features/modelingObjectives/hooks'

export default function DeploymentDetailPage() {
  const { deploymentId = '' } = useParams<{ deploymentId: string }>()
  const navigate = useNavigate()
  const stop     = useStopDeployment()

  const { data: deployment, isLoading: depLoading } = useDeployment(deploymentId)
  const { data: release,    isLoading: relLoading } = useRelease(deployment?.release_id)

  if (depLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
      </div>
    )
  }

  if (!deployment) {
    return (
      <NonIdealState
        icon="search-template"
        title="Deployment not found"
        action={<Button onClick={() => { void navigate('/modeling-objectives') }}>Back to Modeling Objectives</Button>}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Link to="/modeling-objectives" className="text-xs text-muted-foreground hover:text-foreground">Modeling Objectives</Link>
          <Icon icon="chevron-right" size={10} className="text-muted-foreground" />
          {release && (
            <>
              <Link
                to={`/modeling-objectives/${release.objective_name}`}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {release.objective_name}
              </Link>
              <Icon icon="chevron-right" size={10} className="text-muted-foreground" />
            </>
          )}
          <Icon icon="cloud" intent={Intent.PRIMARY} size={14} />
          <h1 className="text-sm font-semibold font-mono">Deployment</h1>
          <Tag minimal intent={statusIntent(deployment.status)}>{deployment.status}</Tag>
          <Tag minimal icon="cloud">{deployment.kind}</Tag>
        </div>
        <p className="text-xs text-muted-foreground">
          Started {formatDistanceToNow(new Date(deployment.started_at), { addSuffix: true })}{' '}
          · last health check {formatDistanceToNow(new Date(deployment.last_health_check), { addSuffix: true })}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Section title="Release" icon="flag">
          {relLoading ? (
            <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
          ) : !release ? (
            <Card className="text-xs italic text-muted-foreground">Linked release not found.</Card>
          ) : (
            <Card className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag minimal intent={stageIntent(release.stage)} icon="flag">{release.stage}</Tag>
                <span className="text-sm font-mono font-semibold">{release.adapter_name}</span>
                <Tag minimal className="font-mono text-[10px]">@ {release.adapter_version}</Tag>
              </div>
              <div className="text-[11px] text-muted-foreground">tag: {release.tag}</div>
              <div className="text-[11px] text-muted-foreground">
                released {formatDistanceToNow(new Date(release.released_at), { addSuffix: true })}
              </div>
            </Card>
          )}
        </Section>

        <Section title="Runtime configuration" icon="cog">
          <Card className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Resource profile</h4>
              <div className="font-mono">{deployment.resource_profile}</div>
            </div>
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Started</h4>
              <div className="font-mono">{new Date(deployment.started_at).toISOString()}</div>
            </div>
          </Card>
        </Section>

        <Section title="Model inference history" icon="database">
          <Callout intent={Intent.NONE} icon="info-sign">
            Inference logging dataset lands with the Supabase edge-function deployment counterpart.
            For now, restock_advisor and waste_triage runs are observable in the Review Queue.
          </Callout>
        </Section>

        <Section title="Logs & metrics" icon="pulse">
          <Callout intent={Intent.NONE} icon="info-sign">
            Live logs + latency/throughput charts arrive when the deployment runs against a Supabase function.
            Backend tables (<span className="font-mono">model_eval_runs</span>, <span className="font-mono">model_releases</span>, <span className="font-mono">model_deployments</span>) are already in place to support this.
          </Callout>
        </Section>

        <Section title="Lifecycle" icon="time">
          <Card className="flex items-center justify-end gap-2">
            {deployment.status === 'running' && (
              <Button
                intent={Intent.DANGER}
                icon="stop"
                loading={stop.isPending}
                onClick={() => { stop.mutate(deployment.id) }}
              >
                Stop deployment
              </Button>
            )}
            {deployment.status === 'stopped' && (
              <span className="text-xs italic text-muted-foreground">
                Deployment stopped. Promote a new release to roll forward.
              </span>
            )}
          </Card>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: 'flag' | 'cog' | 'database' | 'pulse' | 'time'; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon={icon} size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function stageIntent(stage: string): Intent {
  switch (stage) {
    case 'production': return Intent.SUCCESS
    case 'staging':    return Intent.WARNING
    case 'sandbox':    return Intent.NONE
    default:           return Intent.NONE
  }
}

function statusIntent(status: string): Intent {
  switch (status) {
    case 'running':   return Intent.SUCCESS
    case 'starting':  return Intent.WARNING
    case 'failed':    return Intent.DANGER
    case 'stopped':   return Intent.NONE
    default:          return Intent.NONE
  }
}
