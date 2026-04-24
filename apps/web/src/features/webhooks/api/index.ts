import { supabase } from '@/lib/supabase/client'

export interface WebhookEndpoint {
  id:          string
  hotel_id:    string
  name:        string
  url:         string
  secret:      string
  event_types: string[]
  enabled:     boolean
  created_at:  string
  created_by:  string | null
}

export interface WebhookDelivery {
  id:           string
  endpoint_id:  string
  hotel_id:     string
  action_type:  string
  payload:      Record<string, unknown>
  status_code:  number | null
  success:      boolean
  error:        string | null
  duration_ms:  number | null
  delivered_at: string
}

export interface WebhookEndpointInput {
  name:        string
  url:         string
  secret:      string
  event_types: string[]
  enabled:     boolean
}

export async function fetchWebhookEndpoints(): Promise<WebhookEndpoint[]> {
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data as WebhookEndpoint[]
}

export async function createWebhookEndpoint(input: WebhookEndpointInput): Promise<WebhookEndpoint> {
  const createResult = await supabase
    .from('webhook_endpoints')
    .insert(input)
    .select()
    .single()
  if (createResult.error) throw new Error(createResult.error.message)
  return createResult.data as unknown as WebhookEndpoint
}

export async function updateWebhookEndpoint(
  id: string,
  patch: Partial<WebhookEndpointInput>,
): Promise<void> {
  const { error } = await supabase
    .from('webhook_endpoints')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  const { error } = await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchWebhookDeliveries(
  endpointId: string,
  limit = 20,
): Promise<WebhookDelivery[]> {
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .select('id, endpoint_id, hotel_id, action_type, status_code, success, error, duration_ms, delivered_at')
    .eq('endpoint_id', endpointId)
    .order('delivered_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data as WebhookDelivery[]
}
