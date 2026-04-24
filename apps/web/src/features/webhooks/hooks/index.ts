import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import {
  fetchWebhookEndpoints,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  fetchWebhookDeliveries,
} from '../api'
import type { WebhookEndpointInput } from '../api'

const webhookKeys = {
  endpoints: (hotelId: string | null) => ['webhooks', 'endpoints', hotelId] as const,
  deliveries: (endpointId: string)    => ['webhooks', 'deliveries', endpointId] as const,
}

export function useWebhookEndpoints() {
  const hotelId = useAuthStore((s) => s.hotelId)
  return useQuery({
    queryKey: webhookKeys.endpoints(hotelId),
    queryFn:  fetchWebhookEndpoints,
    enabled:  !!hotelId,
    staleTime: 30_000,
  })
}

export function useCreateWebhookEndpoint() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  return useMutation({
    mutationFn: (input: WebhookEndpointInput) => createWebhookEndpoint(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookKeys.endpoints(hotelId) })
      toast.success('Webhook endpoint created')
    },
    onError: (err: Error) => { toast.error(err.message) },
  })
}

export function useUpdateWebhookEndpoint() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<WebhookEndpointInput> }) =>
      updateWebhookEndpoint(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookKeys.endpoints(hotelId) })
      toast.success('Webhook endpoint updated')
    },
    onError: (err: Error) => { toast.error(err.message) },
  })
}

export function useDeleteWebhookEndpoint() {
  const queryClient = useQueryClient()
  const hotelId = useAuthStore((s) => s.hotelId)
  return useMutation({
    mutationFn: (id: string) => deleteWebhookEndpoint(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookKeys.endpoints(hotelId) })
      toast.success('Webhook endpoint deleted')
    },
    onError: (err: Error) => { toast.error(err.message) },
  })
}

export function useWebhookDeliveries(endpointId: string | null) {
  return useQuery({
    queryKey: webhookKeys.deliveries(endpointId ?? ''),
    queryFn:  () => fetchWebhookDeliveries(endpointId ?? ''),
    enabled:  !!endpointId,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  })
}
