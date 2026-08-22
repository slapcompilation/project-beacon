// The fields of a struct property.
//
// "In the Struct fields section, select Add field, then New field. Name the new
//  struct field and optionally add a description. Lastly, map a column from a
//  datasource to the new struct field."  (object-link-types/create-struct-type)
//
// They are their own rows with their own RLS, not part of the property's saved
// schema, so they are written directly rather than through the draft-and-save
// editor the rest of the Properties step uses. That divergence is deliberate
// and recorded in 633's header.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

/** The twelve struct_field_types() admits — a subset of the base types, and
 *  `struct` is absent because "Structs have a depth of one and cannot be
 *  nested". Mirrored here so the picker cannot offer a thirteenth; the CHECK
 *  is still the thing that decides. */
export const STRUCT_FIELD_TYPES = [
  'boolean', 'byte', 'date', 'decimal', 'double', 'float',
  'geopoint', 'integer', 'long', 'short', 'string', 'timestamp',
] as const

export type StructFieldType = (typeof STRUCT_FIELD_TYPES)[number]

export interface StructField {
  id: string
  property_id: string
  api_name: string
  display_name: string
  description: string
  field_type: StructFieldType
  backing_column: string | null
  position: number
}

const KEY = ['struct-fields'] as const

export function useStructFields(propertyIds: string[]) {
  return useQuery({
    queryKey: [...KEY, [...propertyIds].sort().join(',')],
    enabled: propertyIds.length > 0,
    queryFn: async (): Promise<StructField[]> => {
      const { data, error } = await supabase.from('property_struct_fields')
        .select('id, property_id, api_name, display_name, description, field_type, backing_column, position')
        .in('property_id', propertyIds)
        .order('position')
      if (error) throw new Error(error.message)
      return data as StructField[]
    },
  })
}

export interface NewStructField {
  propertyId: string
  apiName: string
  displayName: string
  fieldType: StructFieldType
  backingColumn: string | null
  position: number
}

export function useAddStructField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (f: NewStructField) => {
      const { error } = await supabase.from('property_struct_fields').insert({
        property_id: f.propertyId,
        api_name: f.apiName,
        display_name: f.displayName,
        field_type: f.fieldType,
        backing_column: f.backingColumn,
        position: f.position,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY })
      void qc.invalidateQueries({ queryKey: ['health'] })
      toast.success('Field added')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRemoveStructField() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('property_struct_fields').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY })
      // Removing the last field puts the property back in violation, and the
      // Health issues count is what shows that.
      void qc.invalidateQueries({ queryKey: ['health'] })
      toast.success('Field removed')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
