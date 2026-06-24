import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'
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

const LoginPage = lazyWithRetry(() => import('@/pages/LoginPage'))
const ResetPasswordPage = lazyWithRetry(() => import('@/pages/ResetPasswordPage'))
const AuthCallbackPage = lazyWithRetry(() => import('@/pages/AuthCallbackPage'))
const BriefingPage = lazyWithRetry(() => import('@/pages/BriefingPage'))
const SettingsPage = lazyWithRetry(() => import('@/pages/SettingsPage'))
const AccountPage = lazyWithRetry(() => import('@/pages/AccountPage'))
const AuditPage = lazyWithRetry(() => import('@/pages/AuditPage'))
const StocktakePage = lazyWithRetry(() => import('@/pages/StocktakePage'))
const ScanPage = lazyWithRetry(() => import('@/pages/ScanPage'))
const LabelsPage = lazyWithRetry(() => import('@/pages/LabelsPage'))
const RemindersPage = lazyWithRetry(() => import('@/pages/RemindersPage'))
const PickListsPage = lazyWithRetry(() => import('@/pages/PickListsPage'))
const NotificationsPage = lazyWithRetry(() => import('@/pages/NotificationsPage'))
const GraphPage = lazyWithRetry(() => import('@/pages/GraphPage'))
const EventDemandPage = lazyWithRetry(() => import('@/pages/EventDemandPage'))
const ChainPage = lazyWithRetry(() => import('@/pages/ChainPage'))
const PendingScansPage = lazyWithRetry(() => import('@/pages/PendingScansPage'))
const MenuMappingPage = lazyWithRetry(() => import('@/pages/MenuMappingPage'))
const FBIntelligencePage = lazyWithRetry(() => import('@/pages/FBIntelligencePage'))
const SetupWizardPage = lazyWithRetry(() => import('@/pages/SetupWizardPage'))

const FloorWorkspace = lazyWithRetry(() => import('@/pages/FloorWorkspace'))
const FlowWorkspace  = lazyWithRetry(() => import('@/pages/FlowWorkspace'))
const EyeWorkspace   = lazyWithRetry(() => import('@/pages/EyeWorkspace'))
const MindWorkspace  = lazyWithRetry(() => import('@/pages/MindWorkspace'))
const OperationsWorkspace = lazyWithRetry(() => import('@/pages/OperationsWorkspace'))

const VariantObjectPage       = lazyWithRetry(() => import('@/pages/VariantObjectPage'))
const SupplierObjectPage      = lazyWithRetry(() => import('@/pages/SupplierObjectPage'))
const POObjectPage            = lazyWithRetry(() => import('@/pages/POObjectPage'))
const RestockObjectPage       = lazyWithRetry(() => import('@/pages/RestockObjectPage'))
const ProductObjectPage       = lazyWithRetry(() => import('@/pages/ProductObjectPage'))
const StockLogObjectPage      = lazyWithRetry(() => import('@/pages/StockLogObjectPage'))
const AlertObjectPage         = lazyWithRetry(() => import('@/pages/AlertObjectPage'))
const ShiftHandoverObjectPage = lazyWithRetry(() => import('@/pages/ShiftHandoverObjectPage'))
const CausalChainPage         = lazyWithRetry(() => import('@/pages/CausalChainPage'))
const ReviewQueuePage         = lazyWithRetry(() => import('@/pages/ReviewQueuePage'))
const AgentStudioPage         = lazyWithRetry(() => import('@/pages/AgentStudioPage'))
const AgentDetailPage         = lazyWithRetry(() => import('@/pages/AgentDetailPage'))
const ToolsPage               = lazyWithRetry(() => import('@/pages/ToolsPage'))
const ToolDetailPage          = lazyWithRetry(() => import('@/pages/ToolDetailPage'))
const ModelingObjectivesPage      = lazyWithRetry(() => import('@/pages/ModelingObjectivesPage'))
const ModelingObjectiveDetailPage = lazyWithRetry(() => import('@/pages/ModelingObjectiveDetailPage'))
const DeploymentDetailPage        = lazyWithRetry(() => import('@/pages/DeploymentDetailPage'))
const SystemMapPage               = lazyWithRetry(() => import('@/pages/SystemMapPage'))
const PendingApprovalsPage        = lazyWithRetry(() => import('@/pages/PendingApprovalsPage'))
const ProposalObjectPage          = lazyWithRetry(() => import('@/pages/ProposalObjectPage'))
const PrincipleObjectPage         = lazyWithRetry(() => import('@/pages/PrincipleObjectPage'))
const ConstraintObjectPage        = lazyWithRetry(() => import('@/pages/ConstraintObjectPage'))
const ApprovedAnswersPage         = lazyWithRetry(() => import('@/pages/ApprovedAnswersPage'))
const CasesPage                   = lazyWithRetry(() => import('@/pages/CasesPage'))
const CaseObjectPage              = lazyWithRetry(() => import('@/pages/CaseObjectPage'))
const DocumentsPage               = lazyWithRetry(() => import('@/pages/DocumentsPage'))
const DocumentObjectPage          = lazyWithRetry(() => import('@/pages/DocumentObjectPage'))
const EntityLinkSuggestionsPage   = lazyWithRetry(() => import('@/pages/EntityLinkSuggestionsPage'))
const ActionChainsPage            = lazyWithRetry(() => import('@/pages/ActionChainsPage'))
const ActionChainObjectPage       = lazyWithRetry(() => import('@/pages/ActionChainObjectPage'))
const ScenariosPage               = lazyWithRetry(() => import('@/pages/ScenariosPage'))
const ScenarioDetailPage          = lazyWithRetry(() => import('@/pages/ScenarioDetailPage'))
const CopilotConfigPage           = lazyWithRetry(() => import('@/pages/CopilotConfigPage'))

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
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route element={<AuthGuard />}>
            <Route path="/" element={<RootRedirect />} />

            <Route path="/briefing" element={<BriefingPage />} />
            <Route path="/floor"    element={<FloorWorkspace />} />
            <Route path="/flow"     element={<FlowWorkspace />} />
            <Route path="/eye"      element={<EyeWorkspace />} />
            <Route path="/mind"     element={<MindWorkspace />} />
            <Route path="/operations" element={<OperationsWorkspace />} />

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
            <Route path="/action-chains"                        element={<ActionChainsPage />} />
            <Route path="/action-chains/:chainId"               element={<ActionChainObjectPage />} />
            <Route path="/scenarios"                            element={<ScenariosPage />} />
            <Route path="/scenarios/:scenarioId"                element={<ScenarioDetailPage />} />
            <Route path="/copilot-config"                       element={<CopilotConfigPage />} />

            <Route path="/settings"      element={<SettingsPage />} />
            <Route path="/account"       element={<AccountPage />} />
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
            <Route path="/flow-dashboard"   element={<Navigate to="/mind?aip=queue"            replace />} />
            <Route path="/receive"          element={<Navigate to="/flow?panel=receive"        replace />} />
            <Route path="/restocks"         element={<Navigate to="/mind?aip=restock-approvals" replace />} />
            <Route path="/waste-radar"      element={<Navigate to="/eye?panel=waste"           replace />} />
            <Route path="/occupancy"        element={<Navigate to="/eye?panel=occupancy"       replace />} />
            <Route path="/reports"          element={<Navigate to="/eye?panel=performance"     replace />} />
            <Route path="/finance"          element={<Navigate to="/eye?panel=performance"     replace />} />
            <Route path="/procurement"      element={<Navigate to="/operations?panel=procurement"  replace />} />
            <Route path="/invoicing"        element={<Navigate to="/operations?panel=intelligence" replace />} />
            <Route path="/negotiation-prep" element={<Navigate to="/operations?panel=intelligence" replace />} />
            <Route path="/gl-export"        element={<Navigate to="/operations?panel=gl"           replace />} />
            <Route path="/purchase-orders"  element={<Navigate to="/operations?panel=procurement"  replace />} />
            <Route path="/optimize-pars"    element={<Navigate to="/floor?panel=par"           replace />} />
            <Route path="/leverage"         element={<Navigate to="/operations?panel=leverage"     replace />} />
            <Route path="/suppliers"        element={<Navigate to="/operations?panel=procurement"  replace />} />
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
