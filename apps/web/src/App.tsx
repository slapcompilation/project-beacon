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
const ApplicationsPage = lazyWithRetry(() => import('@/pages/ApplicationsPage'))
const SettingsPage = lazyWithRetry(() => import('@/pages/SettingsPage'))
const AccountPage = lazyWithRetry(() => import('@/pages/AccountPage'))
const AuditPage = lazyWithRetry(() => import('@/pages/AuditPage'))
const StocktakePage = lazyWithRetry(() => import('@/pages/StocktakePage'))
const ScanPage = lazyWithRetry(() => import('@/pages/ScanPage'))
const LabelsPage = lazyWithRetry(() => import('@/pages/LabelsPage'))
const NotificationsPage = lazyWithRetry(() => import('@/pages/NotificationsPage'))
const WhatsNewPage = lazyWithRetry(() => import('@/pages/WhatsNewPage'))
const ProcessMiningPage = lazyWithRetry(() => import('@/pages/ProcessMiningPage'))
const ObjectsPage = lazyWithRetry(() => import('@/pages/ObjectsPage'))
const ProjectsPage = lazyWithRetry(() => import('@/pages/ProjectsPage'))
const ModulePage  = lazyWithRetry(() => import('@/pages/ModulePage'))
const ModuleBuilderPage  = lazyWithRetry(() => import('@/pages/ModuleBuilderPage'))
const ObjectListPage = lazyWithRetry(() => import('@/pages/ObjectListPage'))
const CreateWorkflowGuide = lazyWithRetry(() => import('@/features/mind/CreateWorkflowGuide'))
const CustomRecordPage = lazyWithRetry(() => import('@/pages/CustomRecordPage'))
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
const AgentDetailPage         = lazyWithRetry(() => import('@/pages/AgentDetailPage'))
const ToolDetailPage          = lazyWithRetry(() => import('@/pages/ToolDetailPage'))
const ModelingObjectiveDetailPage = lazyWithRetry(() => import('@/pages/ModelingObjectiveDetailPage'))
const DeploymentDetailPage        = lazyWithRetry(() => import('@/pages/DeploymentDetailPage'))
const ProposalObjectPage          = lazyWithRetry(() => import('@/pages/ProposalObjectPage'))
const PrincipleObjectPage         = lazyWithRetry(() => import('@/pages/PrincipleObjectPage'))
const ApprovedAnswerObjectPage    = lazyWithRetry(() => import('@/pages/ApprovedAnswerObjectPage'))
const ConstraintObjectPage        = lazyWithRetry(() => import('@/pages/ConstraintObjectPage'))
const CasesPage                   = lazyWithRetry(() => import('@/pages/CasesPage'))
const CaseObjectPage              = lazyWithRetry(() => import('@/pages/CaseObjectPage'))
const DocumentsPage               = lazyWithRetry(() => import('@/pages/DocumentsPage'))
const DocumentObjectPage          = lazyWithRetry(() => import('@/pages/DocumentObjectPage'))
const ActionChainsPage            = lazyWithRetry(() => import('@/pages/ActionChainsPage'))
const ActionChainObjectPage       = lazyWithRetry(() => import('@/pages/ActionChainObjectPage'))
const ScenariosPage               = lazyWithRetry(() => import('@/pages/ScenariosPage'))
const ScenarioDetailPage          = lazyWithRetry(() => import('@/pages/ScenarioDetailPage'))

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
            <Route path="/applications" element={<ApplicationsPage />} />
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
            <Route path="/causal-chain"            element={<Navigate to="/graph" replace />} />
            <Route path="/review-queue"            element={<Navigate to="/mind?aip=queue" replace />} />
            <Route path="/agent-studio"            element={<Navigate to="/mind?aip=agents" replace />} />
            <Route path="/agent-studio/:agentName" element={<AgentDetailPage />} />
            <Route path="/tools"                   element={<Navigate to="/mind?aip=tools" replace />} />
            <Route path="/tools/:toolName"         element={<ToolDetailPage />} />
            <Route path="/modeling-objectives"                  element={<Navigate to="/mind?aip=objectives" replace />} />
            <Route path="/modeling-objectives/:objectiveName"   element={<ModelingObjectiveDetailPage />} />
            <Route path="/deployments/:deploymentId"            element={<DeploymentDetailPage />} />
            <Route path="/system-map"                           element={<Navigate to="/mind?aip=system-map" replace />} />
            <Route path="/pending-approvals"                    element={<Navigate to="/mind?aip=approvals" replace />} />
            <Route path="/proposals/:proposalId"                element={<ProposalObjectPage />} />
            <Route path="/principles/:principleId"              element={<PrincipleObjectPage />} />
            <Route path="/answers/:answerId"                    element={<ApprovedAnswerObjectPage />} />
            <Route path="/constraints/:constraintId"            element={<ConstraintObjectPage />} />
            <Route path="/approved-answers"                     element={<Navigate to="/mind?aip=answers" replace />} />
            <Route path="/cases"                                element={<CasesPage />} />
            <Route path="/cases/:caseId"                        element={<CaseObjectPage />} />
            <Route path="/documents"                            element={<DocumentsPage />} />
            <Route path="/documents/:documentId"                element={<DocumentObjectPage />} />
            <Route path="/entity-link-suggestions"              element={<Navigate to="/mind?aip=entity-links" replace />} />
            <Route path="/action-chains"                        element={<ActionChainsPage />} />
            <Route path="/action-chains/:chainId"               element={<ActionChainObjectPage />} />
            <Route path="/scenarios"                            element={<ScenariosPage />} />
            <Route path="/scenarios/:scenarioId"                element={<ScenarioDetailPage />} />
            <Route path="/copilot-config"                       element={<Navigate to="/mind?aip=copilot" replace />} />

            <Route path="/settings"      element={<SettingsPage />} />
            <Route path="/account"       element={<AccountPage />} />
            <Route path="/audit"         element={<AuditPage />} />
            <Route path="/stocktake"     element={<StocktakePage />} />
            <Route path="/labels"        element={<LabelsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/whats-new"     element={<WhatsNewPage />} />
            <Route path="/process"       element={<ProcessMiningPage />} />
            <Route path="/objects"       element={<ObjectsPage />} />
            <Route path="/projects"      element={<ProjectsPage />} />
            {/* Generic on purpose: a new application must not mean a new route. */}
            <Route path="/modules/:apiName" element={<ModulePage />} />
            <Route path="/modules/:apiName/edit" element={<ModuleBuilderPage />} />
            <Route path="/objects/:type" element={<ObjectListPage />} />
            <Route path="/objects/:type/:recordId" element={<CustomRecordPage />} />
            <Route path="/create-workflow" element={<CreateWorkflowGuide />} />
            {/* retired: Reminders folded into Floor · Expiry; Pick Lists lives as a Flow tab */}
            <Route path="/reminders"     element={<Navigate to="/floor?panel=expiry"  replace />} />
            <Route path="/pick-lists"    element={<Navigate to="/flow?panel=picklists" replace />} />
            {/* retired (LEGACY-REDUCTION §C): deep links live on as redirects */}
            <Route path="/graph"         element={<Navigate to="/objects" replace />} />
            <Route path="/events"        element={<Navigate to="/mind?aip=forecast-lab" replace />} />
            <Route path="/chain"         element={<Navigate to="/mind?aip=system-map" replace />} />
            <Route path="/pending-scans" element={<Navigate to="/floor?panel=scans" replace />} />
            <Route path="/menu-mapping"  element={<Navigate to="/briefing" replace />} />
            <Route path="/fb-intelligence" element={<Navigate to="/eye" replace />} />
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
