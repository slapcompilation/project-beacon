// The Capabilities tab's data: slots come from the platform, nominations are
// rows. "In the Ontology Manager, object types now have a Capabilities page to
// configure features historically defined as type classes."
// (object-link-types/metadata-typeclasses)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { capabilitySlots } from '@beacon/platform'

/** One nominatable slot, as the platform publishes it. `accepts` is the base
 *  type list the guard enforces, so the picker offers exactly what will pass. */
export interface CapabilitySlot {
  capability: string
  slot: string
  accepts: string[]
  note: string
}

export function useCapabilitySlots() {
  return useQuery({
    queryKey: ['capability-slots'],
    queryFn: async (): Promise<CapabilitySlot[]> =>
      await client(capabilitySlots).executeFunction({}) as unknown as CapabilitySlot[],
    staleTime: Infinity,   // a fixed vocabulary, not data
  })
}

const key = (typeId: string) => ['object-type-capabilities', typeId]

/** capability/slot → the property nominated for it. */
export function useObjectTypeCapabilities(typeId: string) {
  return useQuery({
    queryKey: key(typeId),
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase.from('object_type_capabilities')
        .select('capability, slot, property_id').eq('object_type_id', typeId)
      if (error) throw new Error(error.message)
      return new Map((data as { capability: string; slot: string; property_id: string }[])
        .map((r) => [`${r.capability}/${r.slot}`, r.property_id]))
    },
  })
}

/** Nominate a property for a slot, or clear it when propertyId is null. The
 *  guard refuses an unknown slot, a foreign property and a type mismatch, so
 *  its message is what the operator sees. */
export function useNominate(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { capability: string; slot: string; propertyId: string | null }) => {
      if (i.propertyId === null) {
        const { error } = await supabase.from('object_type_capabilities').delete()
          .eq('object_type_id', typeId).eq('capability', i.capability).eq('slot', i.slot)
        if (error) throw new Error(error.message)
        return
      }
      const { error } = await supabase.from('object_type_capabilities')
        .upsert({
          object_type_id: typeId, capability: i.capability,
          slot: i.slot, property_id: i.propertyId,
        }, { onConflict: 'object_type_id,capability,slot' })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key(typeId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
