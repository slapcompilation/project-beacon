// Run an adapter against its eval suite and write the metric rows.
//
// Both metrics (MAE + RMSE) compare adapter projection vs. expected from the
// case. For Phase 8 v1 the expected is the deterministic mean × horizon from
// the synthetic cases — sufficient to demonstrate the loop end-to-end. Real
// historical cases backfilled from production stock_logs land later.

import type { EvalSuite, ModelAdapter } from '@beacon/reality-graph'
import { recordEvalRun } from './api'

export interface EvalRunSummary {
  adapterName:    string
  adapterVersion: string
  mae:            number
  rmse:           number
  caseCount:      number
  runs:           Array<{ id: string; value: number; metric: string }>
}

interface ConsumptionForecastCase {
  id: string
  input: {
    logs: ReadonlyArray<unknown>
    horizonDays: number
  }
  expectedOutput?: { projectedUnits: number }
}

interface ForecastResult {
  projectedUnits: number
}

/** Runs every case in the suite against the adapter, computes MAE + RMSE,
 *  and inserts two metric rows. Returns the summary for inline rendering. */
export async function runEvalSuite(args: {
  adapter:         ModelAdapter
  suite:           EvalSuite
  organizationId:  string | null
  userId:          string | null
}): Promise<EvalRunSummary> {
  const errors: number[] = []
  for (const c of args.suite.cases as ConsumptionForecastCase[]) {
    if (!c.expectedOutput) continue
    const result   = await args.adapter.runInference(c.input) as ForecastResult
    const expected = c.expectedOutput.projectedUnits
    const residual = result.projectedUnits - expected
    errors.push(residual)
  }

  const mae  = errors.length > 0 ? mean(errors.map(Math.abs))   : 0
  const rmse = errors.length > 0 ? Math.sqrt(mean(errors.map((e) => e * e))) : 0

  const dataset = args.suite.datasets[0] ?? 'synthetic'

  const maeRow = await recordEvalRun({
    organizationId:    args.organizationId,
    objectiveName:     args.suite.objective,
    adapterName:       args.adapter.name,
    adapterVersion:    args.adapter.version,
    dataset,
    metric:            'mae',
    value:             Number(mae.toFixed(4)),
    caseCount:         errors.length,
    triggeredByUserId: args.userId,
  })

  const rmseRow = await recordEvalRun({
    organizationId:    args.organizationId,
    objectiveName:     args.suite.objective,
    adapterName:       args.adapter.name,
    adapterVersion:    args.adapter.version,
    dataset,
    metric:            'rmse',
    value:             Number(rmse.toFixed(4)),
    caseCount:         errors.length,
    triggeredByUserId: args.userId,
  })

  return {
    adapterName:    args.adapter.name,
    adapterVersion: args.adapter.version,
    mae:            Number(mae.toFixed(4)),
    rmse:           Number(rmse.toFixed(4)),
    caseCount:      errors.length,
    runs: [
      { id: maeRow.id,  value: maeRow.value,  metric: maeRow.metric  },
      { id: rmseRow.id, value: rmseRow.value, metric: rmseRow.metric },
    ],
  }
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length
}
