import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { useAuthStore } from '@/stores/auth.store'
import { AuthGuard } from '@/components/AuthGuard'
import { AuthProvider } from '@/components/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ScanLayout } from '@/components/layout/ScanLayout'
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Route-level lazy imports — each page is its own chunk
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const BriefingPage = lazy(() => import('@/pages/BriefingPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const AuditPage = lazy(() => import('@/pages/AuditPage'))
const StocktakePage = lazy(() => import('@/pages/StocktakePage'))
const ScanPage = lazy(() => import('@/pages/ScanPage'))
const LabelsPage = lazy(() => import('@/pages/LabelsPage'))
const RemindersPage = lazy(() => import('@/pages/RemindersPage'))
const PickListsPage = lazy(() => import('@/pages/PickListsPage'))
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'))
const GraphPage = lazy(() => import('@/pages/GraphPage'))
const EventDemandPage = lazy(() => import('@/pages/EventDemandPage'))
const ChainPage = lazy(() => import('@/pages/ChainPage'))
const MonitorPage = lazy(() => import('@/pages/MonitorPage'))
const PendingScansPage = lazy(() => import('@/pages/PendingScansPage'))
const MenuMappingPage = lazy(() => import('@/pages/MenuMappingPage'))
const FBIntelligencePage = lazy(() => import('@/pages/FBIntelligencePage'))
const ARPreviewPage   = lazy(() => import('@/pages/ARPreviewPage'))
const SetupWizardPage = lazy(() => import('@/pages/SetupWizardPage'))

// Four-layer workspaces
const FloorWorkspace = lazy(() => import('@/pages/FloorWorkspace'))
const FlowWorkspace  = lazy(() => import('@/pages/FlowWorkspace'))
const EyeWorkspace   = lazy(() => import('@/pages/EyeWorkspace'))
const MindWorkspace  = lazy(() => import('@/pages/MindWorkspace'))

// Object pages — click any entity name to see full object context
const VariantObjectPage       = lazy(() => import('@/pages/VariantObjectPage'))
const SupplierObjectPage      = lazy(() => import('@/pages/SupplierObjectPage'))
const POObjectPage            = lazy(() => import('@/pages/POObjectPage'))
const RestockObjectPage       = lazy(() => import('@/pages/RestockObjectPage'))
const ProductObjectPage       = lazy(() => import('@/pages/ProductObjectPage'))
const StockLogObjectPage      = lazy(() => import('@/pages/StockLogObjectPage'))
const AlertObjectPage         = lazy(() => import('@/pages/AlertObjectPage'))
const ShiftHandoverObjectPage = lazy(() => import('@/pages/ShiftHandoverObjectPage'))
const CausalChainPage         = lazy(() => import('@/pages/CausalChainPage'))

function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

function RootRedirect() {
  const role = useAuthStore((s) => s.role)
  // Mission-driven home: each role lands on its primary decision surface
  const home =
    role === 'limited_access' ? '/scan' :
    role === 'team_member'    ? '/floor' :
    '/briefing'
  return <Navigate to={home} replace />
}

// Separated so AuthProvider (which starts getSession) always mounts first
function AppRoutes() {
  const isLoading = useAuthStore((s) => s.isLoading)

  if (isLoading) return <PageLoader />

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGuard />}>
            <Route path="/" element={<RootRedirect />} />

            {/* ── Primary nav (5 items) ──────────────────────────────────── */}
            <Route path="/briefing" element={<BriefingPage />} />
            <Route path="/floor"    element={<FloorWorkspace />} />
            <Route path="/flow"     element={<FlowWorkspace />} />
            <Route path="/eye"      element={<EyeWorkspace />} />
            <Route path="/mind"     element={<MindWorkspace />} />

            {/* ── Object pages — entity deep-dives ─────────────────────── */}
            <Route path="/variant/:variantId"      element={<VariantObjectPage />} />
            <Route path="/supplier/:supplierId"    element={<SupplierObjectPage />} />
            <Route path="/po/:poId"                element={<POObjectPage />} />
            <Route path="/restock/:restockId"      element={<RestockObjectPage />} />
            <Route path="/product/:productId"      element={<ProductObjectPage />} />
            <Route path="/log/:logId"              element={<StockLogObjectPage />} />
            <Route path="/alert/:alertId"          element={<AlertObjectPage />} />
            <Route path="/handover/:handoverId"    element={<ShiftHandoverObjectPage />} />
            <Route path="/causal-chain"            element={<CausalChainPage />} />

            {/* ── Utility routes ────────────────────────────────────────── */}
            <Route path="/settings"      element={<SettingsPage />} />
            <Route path="/audit"         element={<AuditPage />} />
            <Route path="/stocktake"     element={<StocktakePage />} />
            <Route path="/labels"        element={<LabelsPage />} />
            <Route path="/reminders"     element={<RemindersPage />} />
            <Route path="/pick-lists"    element={<PickListsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/graph"         element={<GraphPage />} />
            <Route path="/events"        element={<EventDemandPage />} />
            <Route path="/chain"         element={<ChainPage />} />
            <Route path="/monitor"       element={<MonitorPage />} />
            <Route path="/pending-scans" element={<PendingScansPage />} />
            <Route path="/menu-mapping"  element={<MenuMappingPage />} />
            <Route path="/fb-intelligence" element={<FBIntelligencePage />} />
            <Route path="/setup"           element={<SetupWizardPage />} />

            {/* ── Redirects: old routes → workspace panels ──────────────── */}
            <Route path="/dashboard"        element={<Navigate to="/briefing"                  replace />} />
            <Route path="/inventory"        element={<Navigate to="/floor?panel=stock"         replace />} />
            <Route path="/alerts"           element={<Navigate to="/floor?panel=alerts"        replace />} />
            <Route path="/expiry"           element={<Navigate to="/floor?panel=expiry"        replace />} />
            <Route path="/timeline"         element={<Navigate to="/flow?panel=timeline"       replace />} />
            <Route path="/flow-dashboard"   element={<Navigate to="/flow?panel=timeline"       replace />} />
            <Route path="/receive"          element={<Navigate to="/flow?panel=receive"        replace />} />
            <Route path="/restocks"         element={<Navigate to="/flow?panel=approvals"      replace />} />
            <Route path="/waste-radar"      element={<Navigate to="/eye?panel=signals"         replace />} />
            <Route path="/occupancy"        element={<Navigate to="/eye?panel=forecasts"       replace />} />
            <Route path="/reports"          element={<Navigate to="/eye?panel=analytics"       replace />} />
            <Route path="/finance"          element={<Navigate to="/eye?panel=analytics"       replace />} />
            <Route path="/procurement"      element={<Navigate to="/mind?panel=procurement"    replace />} />
            <Route path="/invoicing"        element={<Navigate to="/mind?panel=intelligence"   replace />} />
            <Route path="/negotiation-prep" element={<Navigate to="/mind?panel=intelligence"   replace />} />
            <Route path="/gl-export"        element={<Navigate to="/mind?panel=gl"             replace />} />
            <Route path="/purchase-orders"  element={<Navigate to="/mind?panel=procurement"    replace />} />
            <Route path="/optimize-pars"    element={<Navigate to="/floor?panel=stock"         replace />} />
            <Route path="/leverage"         element={<Navigate to="/mind?panel=intelligence"   replace />} />
            <Route path="/suppliers"        element={<Navigate to="/mind?panel=procurement"    replace />} />
            <Route path="/team"             element={<Navigate to="/settings?section=team"     replace />} />

            {/* Scan-first UI — uses its own minimal layout */}
            <Route element={<ScanLayout />}>
              <Route path="/scan"    element={<ScanPage />} />
              <Route path="/scan/ar" element={<ARPreviewPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/briefing" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <Toaster richColors position="top-right" />
          <PwaInstallPrompt />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
