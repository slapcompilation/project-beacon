import { useQuery } from '@tanstack/react-query'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  fetchRecentActivity,
  fetchStockMovementReport,
  fetchWasteReport,
  fetchAuditLog,
  fetchShiftActivity,
} from '../api/reports'

export function useRecentActivity(limit = 20) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['recent-activity', hotelId, limit],
    queryFn: () => fetchRecentActivity(limit),
    enabled: !!hotelId,
  })
}

export function useWasteReport(dateFrom?: string, dateTo?: string) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['waste-report', hotelId, dateFrom, dateTo],
    queryFn: () => fetchWasteReport(dateFrom, dateTo),
    enabled: !!hotelId,
  })
}

export function useStockMovementReport(dateFrom?: string, dateTo?: string) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['stock-movement-report', hotelId, dateFrom, dateTo],
    queryFn: () => fetchStockMovementReport(dateFrom, dateTo),
    enabled: !!hotelId,
  })
}

export function useShiftActivity(since: string | null) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['shift-activity', hotelId, since],
    queryFn: () => fetchShiftActivity(hotelId ?? '', since ?? ''),
    enabled: !!hotelId && !!since,
    staleTime: 60 * 1000,
  })
}

export function useAuditLog(opts?: {
  dateFrom?: string
  dateTo?: string
  search?: string
}) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['audit-log', hotelId, opts?.dateFrom, opts?.dateTo, opts?.search],
    queryFn: () => fetchAuditLog(hotelId ?? '', opts),
    enabled: !!hotelId,
  })
}
