// The Capabilities tab's Time series panel — its data.
//
// A time series property is not authored by choosing a base type. It is an
// existing string property designated as one: "Select an existing object type
// property with series IDs to set as time series property"
// (time-series-setup-add-tsp-dialog-2.png). So `designate` UPDATES a property
// rather than creating one, and `release` puts it back to `string`.
//
// The item type is never asked for. A sync's own value column answers it — a
// String value column "indicates a Categorical time series", and "different
// data types cannot exist within one time series sync" — which is why the
// dialog tags a sync `Numerical` and asks nothing. 780 made that a platform
// function so the surface does not carry the rule privately.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { timeSeriesSyncItemType } from '@beacon/platform'

export interface TimeSeriesSync {
  id: string
  name: string
  inputDatasetId: string
  valueColumn: string
}

/** One row of the panel's table: PROPERTY NAME, TIME SERIES SYNC, BASE FORMATTER. */
/** The api's constant-or-property union, which is what the page's "point to
 *  other `string` properties … for more granular control" describes. Our
 *  `propertyApiName` carries a PROPERTY_ID, the seam 736 recorded. */
export type FormatterOperand =
  | { constant: { value: string } }
  | { propertyType: { propertyApiName: string } }

export interface TimeSeriesProperty {
  id: string
  apiName: string
  displayName: string
  isDefault: boolean
  interpolation: FormatterOperand | null
  units: FormatterOperand | null
  /** 'double' | 'string' | 'numericOrNonNumeric', declared since 779. */
  itemType: string | null
  syncId: string | null
  syncName: string | null
  /** The datasource row that carries the sync, so removal can clean it up. */
  datasourceId: string | null
}

const key = (typeId: string) => ['time-series-properties', typeId]

export function useTimeSeriesProperties(typeId: string) {
  return useQuery({
    queryKey: key(typeId),
    queryFn: async (): Promise<TimeSeriesProperty[]> => {
      const { data, error } = await supabase.from('object_type_properties')
        .select('id, api_name, display_name, is_default_time_series, time_series_item_type, ' +
                'time_series_interpolation, time_series_units, position')
        .eq('object_type_id', typeId).eq('base_type', 'time_series').order('position')
      if (error) throw new Error(error.message)
      const rows = data as unknown as {
        id: string; api_name: string; display_name: string
        is_default_time_series: boolean; time_series_item_type: string | null
        time_series_interpolation: FormatterOperand | null
        time_series_units: FormatterOperand | null
      }[]
      if (rows.length === 0) return []

      const bound = await supabase.from('object_type_time_series_sources')
        .select('property_id, datasource_id, object_type_datasources!inner(time_series_syncs(id, name))')
        .in('property_id', rows.map((r) => r.id))
      if (bound.error) throw new Error(bound.error.message)
      const byProperty = new Map((bound.data as unknown as {
        property_id: string; datasource_id: string
        object_type_datasources: { time_series_syncs: { id: string; name: string } | null } | null
      }[]).map((b) => [b.property_id, b]))

      return rows.map((r) => {
        const b = byProperty.get(r.id)
        const sync = b?.object_type_datasources?.time_series_syncs ?? null
        return {
          id: r.id, apiName: r.api_name, displayName: r.display_name,
          isDefault: r.is_default_time_series, itemType: r.time_series_item_type,
          interpolation: r.time_series_interpolation, units: r.time_series_units,
          syncId: sync?.id ?? null, syncName: sync?.name ?? null,
          datasourceId: b?.datasource_id ?? null,
        }
      })
    },
  })
}

/** Every sync the reader can see. A sync is addressed by RID and has no api
 *  name, and "one sync serves many object types" — so this is not scoped to
 *  the type being edited. */
export function useTimeSeriesSyncs() {
  return useQuery({
    queryKey: ['time-series-syncs'],
    queryFn: async (): Promise<TimeSeriesSync[]> => {
      const { data, error } = await supabase.from('time_series_syncs')
        .select('id, name, input_dataset_id, value_column').order('name')
      if (error) throw new Error(error.message)
      return (data as unknown as {
        id: string; name: string; input_dataset_id: string; value_column: string
      }[]).map((r) => ({
        id: r.id, name: r.name, inputDatasetId: r.input_dataset_id, valueColumn: r.value_column,
      }))
    },
    staleTime: 30_000,
  })
}

/** "A dataset may also be selected and it will be indexed as a time series
 *  sync" — the sync lives where its input dataset lives, so neither the
 *  organization nor the project is asked for. */
export function useCreateTimeSeriesSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: {
      datasetId: string; name: string
      seriesIdColumn: string; timestampColumn: string; valueColumn: string
      timestampUnit: string | null
    }): Promise<string> => {
      const owner = await supabase.from('datasets')
        .select('organization_id, project_id').eq('id', i.datasetId).single()
      if (owner.error) throw new Error(owner.error.message)
      const o = owner.data as unknown as { organization_id: string; project_id: string }
      const { data, error } = await supabase.from('time_series_syncs').insert({
        organization_id: o.organization_id, project_id: o.project_id,
        input_dataset_id: i.datasetId, name: i.name,
        series_id_column: i.seriesIdColumn, timestamp_column: i.timestampColumn,
        value_column: i.valueColumn, timestamp_unit: i.timestampUnit,
      }).select('id').single()
      if (error) throw new Error(error.message)
      return (data as unknown as { id: string }).id
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['time-series-syncs'] }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Designate an existing string property, bind it to a sync, and let the sync
 *  say what its values are. The first one of an object type becomes the default
 *  without being asked — 780's trigger, not this code. */
export function useDesignateTimeSeriesProperty(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { propertyId: string; syncId: string; setDefault: boolean }) => {
      const itemType = await client(timeSeriesSyncItemType)
        .executeFunction({ p_sync: i.syncId })
      // Null comes back when the sync's dataset has no committed schema to read
      // the value column from, and 779's CHECK takes only the api's members —
      // so what the sync answers is checked rather than trusted.
      if (itemType !== 'string' && itemType !== 'double') {
        throw new Error(
          'The sync\'s dataset has no committed schema, so its value column cannot say whether the series are numerical')
      }
      const designated = await supabase.from('object_type_properties')
        .update({ base_type: 'time_series', time_series_item_type: itemType })
        .eq('id', i.propertyId)
      if (designated.error) throw new Error(designated.error.message)

      // One sync datasource per sync per object type; a second property may
      // reuse it, and `object_type_datasources_one_backing` refuses a mixture.
      const existing = await supabase.from('object_type_datasources')
        .select('id').eq('object_type_id', typeId).eq('time_series_sync_id', i.syncId).maybeSingle()
      if (existing.error) throw new Error(existing.error.message)
      let datasourceId = (existing.data as { id: string } | null)?.id
      if (datasourceId === undefined) {
        const made = await supabase.from('object_type_datasources')
          .insert({ object_type_id: typeId, time_series_sync_id: i.syncId }).select('id').single()
        if (made.error) throw new Error(made.error.message)
        datasourceId = (made.data as unknown as { id: string }).id
      }

      const bound = await supabase.from('object_type_time_series_sources')
        .insert({ datasource_id: datasourceId, property_id: i.propertyId })
      if (bound.error) throw new Error(bound.error.message)

      if (i.setDefault) await makeDefault(typeId, i.propertyId)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(typeId) })
      void qc.invalidateQueries({ queryKey: ['object-types'] })
      toast.success('Time series property added')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Only one row may carry the flag, so the old default is cleared first — the
 *  partial unique index refuses the pair, not the sequence. */
async function makeDefault(typeId: string, propertyId: string): Promise<void> {
  const cleared = await supabase.from('object_type_properties')
    .update({ is_default_time_series: false })
    .eq('object_type_id', typeId).eq('is_default_time_series', true)
  if (cleared.error) throw new Error(cleared.error.message)
  const set = await supabase.from('object_type_properties')
    .update({ is_default_time_series: true }).eq('id', propertyId)
  if (set.error) throw new Error(set.error.message)
}

export function useSetDefaultTimeSeriesProperty(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId: string) => makeDefault(typeId, propertyId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key(typeId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The page says the table is where you "add or delete time series properties".
 *  Deleting the designation, not the property: the column keeps holding strings
 *  and the property goes back to being a string one. */
export function useReleaseTimeSeriesProperty(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { propertyId: string; datasourceId: string | null }) => {
      const unbound = await supabase.from('object_type_time_series_sources')
        .delete().eq('property_id', i.propertyId)
      if (unbound.error) throw new Error(unbound.error.message)

      // base_type and the two things only a time series property may carry go
      // in ONE statement — the CHECKs are per row, and a `string` property
      // holding the default flag is not a legal intermediate state.
      const released = await supabase.from('object_type_properties')
        .update({ base_type: 'string', time_series_item_type: null, is_default_time_series: false })
        .eq('id', i.propertyId)
      if (released.error) throw new Error(released.error.message)

      // A sync datasource nothing is bound to backs nothing.
      if (i.datasourceId !== null) {
        const still = await supabase.from('object_type_time_series_sources')
          .select('property_id').eq('datasource_id', i.datasourceId).limit(1)
        if (still.error) throw new Error(still.error.message)
        if (still.data.length === 0) {
          const gone = await supabase.from('object_type_datasources').delete().eq('id', i.datasourceId)
          if (gone.error) throw new Error(gone.error.message)
        }
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(typeId) })
      void qc.invalidateQueries({ queryKey: ['object-types'] })
      toast.success('Time series property removed')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The base formatter. Both fields are the same operand, and clearing the
 *  formatter is clearing both — the popover's master toggle. */
export function useSetTimeSeriesFormatting(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: {
      propertyId: string
      interpolation: FormatterOperand | null
      units: FormatterOperand | null
    }) => {
      const { error } = await supabase.from('object_type_properties').update({
        time_series_interpolation: i.interpolation, time_series_units: i.units,
      }).eq('id', i.propertyId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key(typeId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
