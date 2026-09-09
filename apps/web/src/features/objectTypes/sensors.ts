// Sensor object types: the Capabilities configuration, and the read that makes
// it mean something.
//
// A sensor object type is an ordinary dataset-backed object type that "records
// time series data for a linked object type". What is configured here is the
// designation and the Sensor link entries — the link reaching a root object
// type, and the property carrying this sensor's name for that link.
//
// Units and Internal interpolation are NOT here. The sensor section is a second
// editor for the operands 782 already stores on the time series property, not
// second storage, so those two controls write `time_series_units` and
// `time_series_interpolation` in their propertyType form.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { sensorSeries } from '@beacon/platform'

/** One Sensor link entry. Repeatable — the section carries "+ Add new entry". */
export interface SensorLink {
  id: string
  linkTypeId: string
  sensorNamePropertyId: string
}

const key = (typeId: string) => ['sensor-links', typeId]

export function useSensorLinks(typeId: string) {
  return useQuery({
    queryKey: key(typeId),
    queryFn: async (): Promise<SensorLink[]> => {
      const { data, error } = await supabase.from('object_type_sensor_links')
        .select('id, link_type_id, sensor_name_property_id')
        .eq('object_type_id', typeId).order('created_at')
      if (error) throw new Error(error.message)
      return (data as unknown as {
        id: string; link_type_id: string; sensor_name_property_id: string
      }[]).map((r) => ({
        id: r.id, linkTypeId: r.link_type_id, sensorNamePropertyId: r.sensor_name_property_id,
      }))
    },
  })
}

/** The toggle. The guard refuses an entry on a type whose toggle is off, so
 *  turning it OFF clears the entries first — otherwise the next save would meet
 *  rows the guard would now refuse. */
export function useSetIsSensor(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (on: boolean) => {
      if (!on) {
        const cleared = await supabase.from('object_type_sensor_links')
          .delete().eq('object_type_id', typeId)
        if (cleared.error) throw new Error(cleared.error.message)
      }
      const { error } = await supabase.from('object_types')
        .update({ is_sensor: on }).eq('id', typeId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(typeId) })
      void qc.invalidateQueries({ queryKey: ['object-types'] })
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSaveSensorLink(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { id?: string; linkTypeId: string; sensorNamePropertyId: string }) => {
      const row = {
        object_type_id: typeId, link_type_id: i.linkTypeId,
        sensor_name_property_id: i.sensorNamePropertyId,
      }
      const { error } = i.id === undefined
        ? await supabase.from('object_type_sensor_links').insert(row)
        : await supabase.from('object_type_sensor_links').update(row).eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key(typeId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRemoveSensorLink(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('object_type_sensor_links').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key(typeId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** One point of one sensor's series, as `sensor_series` returns it. */
export interface SensorPoint {
  sensor_object_type: string
  sensor_primary_key: string
  sensor_name: string
  point_time: string
  num: number | null
  cat: string | null
}

/** What a ROOT object's sensors are reading — the search-around the time series
 *  overview describes, as one call. */
export function useSensorSeries(rootTypeId: string | null, primaryKey: string | null) {
  return useQuery({
    queryKey: ['sensor-series', rootTypeId ?? '', primaryKey ?? ''],
    enabled: rootTypeId !== null && primaryKey !== null,
    queryFn: async (): Promise<SensorPoint[]> =>
      (await client(sensorSeries).executeFunction({
        p_root_object_type: rootTypeId as string, p_primary_key: primaryKey as string,
      })) as unknown as SensorPoint[],
  })
}
