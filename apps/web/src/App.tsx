import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BlueprintProvider, FocusStyleManager, Spinner, SpinnerSize, Intent } from '@blueprintjs/core'
import { Toaster } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { AuthGuard } from '@/components/AuthGuard'
import { AuthProvider } from '@/components/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ScanLayout } from '@/components/layout/ScanLayout'
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Hide focus rings on mouse nav, show them on keyboard nav.
FocusStyleManager.onlyShowFocusOnTabs()

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
const PendingScansPage = lazy(() => import('@/pages/PendingScansPage'))
const MenuMappingPage = lazy(() => import('@/pages/MenuMappingPage'))
const FBIntelligencePage = lazy(() => import('@/pages/FBIntelligencePage'))
const SetupWizardPage = lazy(() => import('@/pages/SetupWizardPage'))

const FloorWorkspace = lazy(() => import('@/pages/FloorWorkspace'))
const FlowWorkspace  = lazy(() => import('@/pages/FlowWorkspace'))
const EyeWorkspace   = lazy(() => import('@/pages/EyeWorkspace'))
const MindWorkspace  = lazy(() => import('@/pages/MindWorkspace'))

const VariantObjectPage       = lazy(() => import('@/pages/VariantObjectPage'))
const SupplierObjectPage      = lazy(() => import('@/pages/SupplierObjectPage'))
const POObjectPage            = lazy(() => import('@/pages/POObjectPage'))
const RestockObjectPage       = lazy(() => import('@/pages/RestockObjectPage'))
const ProductObjectPage       = lazy(() => import('@/pages/ProductObjectPage'))
const StockLogObjectPage      = lazy(() => import('@/pages/StockLogObjectPage'))
const AlertObjectPage         = lazy(() => import('@/pages/AlertObjectPage'))
const ShiftHandoverObjectPage = lazy(() => import('@/pages/ShiftHandoverObjectPage'))
const CausalChainPage         = lazy(() => import('@/pages/CausalChainPage'))
const ReviewQueuePage         = lazy(() => import('@/pages/ReviewQueuePage'))
const AgentStudioPage         = lazy(() => import('@/pages/AgentStudioPage'))
const AgentDetailPage         = lazy(() => import('@/pages/AgentDetailPage'))
const ToolsPage               = lazy(() => import('@/pages/ToolsPage'))
const ToolDetailPage          = lazy(() => import('@/pages/ToolDetailPage'))
const ModelingObjectivesPage      = lazy(() => import('@/pages/ModelingObjectivesPage'))
const ModelingObjectiveDetailPage = lazy(() => import('@/pages/ModelingObjectiveDetailPage'))
const DeploymentDetailPage        = lazy(() => import('@/pages/DeploymentDetailPage'))
const SystemMapPage               = lazy(() => import('@/pages/SystemMapPage'))
const PendingApprovalsPage        = lazy(() => import('@/pages/PendingApprovalsPage'))
const ProposalObjectPage          = lazy(() => import('@/pages/ProposalObjectPage'))
const PrincipleObjectPage         = lazy(() => import('@/pages/PrincipleObjectPage'))
const ConstraintObjectPage        = lazy(() => import('@/pages/ConstraintObjectPage'))
const ApprovedAnswersPage         = lazy(() => import('@/pages/ApprovedAnswersPage'))
const CasesPage                   = lazy(() => import('@/pages/CasesPage'))
const CaseObjectPage              = lazy(() => import('@/pages/CaseObjectPage'))
const DocumentsPage               = lazy(() => import('@/pages/DocumentsPage'))
const DocumentObjectPage          = lazy(() => import('@/pages/DocumentObjectPage'))
const EntityLinkSuggestionsPage   = lazy(() => import('@/pages/EntityLinkSuggestionsPage'))
const ScenariosPage               = lazy(() => import('@/pages/ScenariosPage'))
const ScenarioObjectPage          = lazy(() => import('@/pages/ScenarioObjectPage'))
const CopilotConfigPage           = lazy(() => import('@/pages/CopilotConfigPage'))

function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Spinner size={SpinnerSize.LARGE} intent={Intent.PRIMARY} />
    </div>
  )
}

function RootRedirect() {
  const role = useAuthStore((s) => s.role)
  const home =
    role === 'limited_access' ? '/scan' :
    role === 'team_member'    ? '/floor' :
    '/briefing'
  return <Navigate to={home} replace />
}

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

            <Route path="/briefing" element={<BriefingPage />} />
            <Route path="/floor"    element={<FloorWorkspace />} />
            <Route path="/flow"     element={<FlowWorkspace />} />
            <Route path="/eye"      element={<EyeWorkspace />} />
            <Route path="/mind"     element={<MindWorkspace />} />

            <Route path="/variant/:variantId"      element={<VariantObjectPage />} />
            <Route path="/supplier/:supplierId"    element={<SupplierObjectPage />} />
            <Route path="/po/:poId"                element={<POObjectPage />} />
            <Route path="/restock/:restockId"      element={<RestockObjectPage />} />
            <Route path="/product/:productId"      element={<ProductObjectPage />} />
            <Route path="/log/:logId"              element={<StockLogObjectPage />} />
            <Route path="/alert/:alertId"          element={<AlertObjectPage />} />
            <Route path="/handover/:handoverId"    element={<ShiftHandoverObjectPage />} />
            <Route path="/causal-chain"            element={<CausalChainPage />} />
            <Route path="/review-queue"            element={<ReviewQueuePage />} />
            <Route path="/agent-studio"            element={<AgentStudioPage />} />
            <Route path="/agent-studio/:agentName" element={<AgentDetailPage />} />
            <Route path="/tools"                   element={<ToolsPage />} />
            <Route path="/tools/:toolName"         element={<ToolDetailPage />} />
            <Route path="/modeling-objectives"                  element={<ModelingObjectivesPage />} />
            <Route path="/modeling-objectives/:objectiveName"   element={<ModelingObjectiveDetailPage />} />
            <Route path="/deployments/:deploymentId"            element={<DeploymentDetailPage />} />
            <Route path="/system-map"                           element={<SystemMapPage />} />
            <Route path="/pending-approvals"                    element={<PendingApprovalsPage />} />
            <Route path="/proposals/:proposalId"                element={<ProposalObjectPage />} />
            <Route path="/principles/:principleId"              element={<PrincipleObjectPage />} />
            <Route path="/constraints/:constraintId"            element={<ConstraintObjectPage />} />
            <Route path="/approved-answers"                     element={<ApprovedAnswersPage />} />
            <Route path="/cases"                                element={<CasesPage />} />
            <Route path="/cases/:caseId"                        element={<CaseObjectPage />} />
            <Route path="/documents"                            element={<DocumentsPage />} />
            <Route path="/documents/:documentId"                element={<DocumentObjectPage />} />
            <Route path="/entity-link-suggestions"              element={<EntityLinkSuggestionsPage />} />
            <Route path="/scenarios"                            element={<ScenariosPage />} />
            <Route path="/scenarios/:scenarioId"                element={<ScenarioObjectPage />} />
            <Route path="/copilot-config"                       element={<CopilotConfigPage />} />

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
            <Route path="/pending-scans" element={<PendingScansPage />} />
            <Route path="/menu-mapping"  element={<MenuMappingPage />} />
            <Route path="/fb-intelligence" element={<FBIntelligencePage />} />
            <Route path="/setup"           element={<SetupWizardPage />} />

            <Route path="/dashboard"        element={<Navigate to="/briefing"                  replace />} />
            <Route path="/inventory"        element={<Navigate to="/floor?panel=stock"         replace />} />
            <Route path="/alerts"           element={<Navigate to="/floor?panel=alerts"        replace />} />
            <Route path="/expiry"           element={<Navigate to="/floor?panel=expiry"        replace />} />
            <Route path="/timeline"         element={<Navigate to="/flow?panel=timeline"       replace />} />
            <Route path="/flow-dashboard"   element={<Navigate to="/flow?panel=dashboard"      replace />} />
            <Route path="/receive"          element={<Navigate to="/flow?panel=receive"        replace />} />
            <Route path="/restocks"         element={<Navigate to="/flow?panel=approvals"      replace />} />
            <Route path="/waste-radar"      element={<Navigate to="/eye?panel=waste"           replace />} />
            <Route path="/occupancy"        element={<Navigate to="/eye?panel=occupancy"       replace />} />
            <Route path="/reports"          element={<Navigate to="/eye?panel=performance"     replace />} />
            <Route path="/finance"          element={<Navigate to="/eye?panel=performance"     replace />} />
            <Route path="/procurement"      element={<Navigate to="/mind?panel=procurement"    replace />} />
            <Route path="/invoicing"        element={<Navigate to="/mind?panel=intelligence"   replace />} />
            <Route path="/negotiation-prep" element={<Navigate to="/mind?panel=intelligence"   replace />} />
            <Route path="/gl-export"        element={<Navigate to="/mind?panel=gl"             replace />} />
            <Route path="/purchase-orders"  element={<Navigate to="/mind?panel=procurement"    replace />} />
            <Route path="/optimize-pars"    element={<Navigate to="/floor?panel=par"           replace />} />
            <Route path="/leverage"         element={<Navigate to="/mind?panel=leverage"       replace />} />
            <Route path="/suppliers"        element={<Navigate to="/mind?panel=procurement"    replace />} />
            <Route path="/team"             element={<Navigate to="/settings?section=team"     replace />} />

            <Route element={<ScanLayout />}>
              <Route path="/scan" element={<ScanPage />} />
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
      <BlueprintProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppRoutes />
            <Toaster richColors position="top-right" />
            <PwaInstallPrompt />
          </AuthProvider>
        </ThemeProvider>
      </BlueprintProvider>
    </ErrorBoundary>
  )
}
