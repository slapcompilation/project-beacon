import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { BlueprintProvider, FocusStyleManager, Spinner, SpinnerSize, Intent } from '@blueprintjs/core'
import { Toaster } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { AuthGuard } from '@/components/AuthGuard'
import { AuthProvider } from '@/components/AuthProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Hide focus rings on mouse nav, show them on keyboard nav.
FocusStyleManager.onlyShowFocusOnTabs()

const LoginPage = lazyWithRetry(() => import('@/pages/LoginPage'))
const ResetPasswordPage = lazyWithRetry(() => import('@/pages/ResetPasswordPage'))
const AuthCallbackPage = lazyWithRetry(() => import('@/pages/AuthCallbackPage'))
const ApplicationsPage = lazyWithRetry(() => import('@/pages/ApplicationsPage'))
const SettingsPage = lazyWithRetry(() => import('@/pages/SettingsPage'))
const AccountPage = lazyWithRetry(() => import('@/pages/AccountPage'))
const NotificationsPage = lazyWithRetry(() => import('@/pages/NotificationsPage'))
const ObjectsPage = lazyWithRetry(() => import('@/pages/ObjectsPage'))
const ProjectsPage = lazyWithRetry(() => import('@/pages/ProjectsPage'))
const ModulePage  = lazyWithRetry(() => import('@/pages/ModulePage'))
const ModuleBuilderPage  = lazyWithRetry(() => import('@/pages/ModuleBuilderPage'))
const ObjectListPage = lazyWithRetry(() => import('@/pages/ObjectListPage'))
const CreateWorkflowGuide = lazyWithRetry(() => import('@/features/mind/CreateWorkflowGuide'))
const CustomRecordPage = lazyWithRetry(() => import('@/pages/CustomRecordPage'))

const MindWorkspace  = lazyWithRetry(() => import('@/pages/MindWorkspace'))

const AgentDetailPage         = lazyWithRetry(() => import('@/pages/AgentDetailPage'))
const ToolDetailPage          = lazyWithRetry(() => import('@/pages/ToolDetailPage'))
const DocumentsPage               = lazyWithRetry(() => import('@/pages/DocumentsPage'))
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
  return <Navigate to="/objects" replace />
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

            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/mind"     element={<MindWorkspace />} />

            <Route path="/agent-studio"            element={<Navigate to="/mind?aip=agents" replace />} />
            <Route path="/agent-studio/:agentName" element={<AgentDetailPage />} />
            <Route path="/tools"                   element={<Navigate to="/mind?aip=tools" replace />} />
            <Route path="/tools/:toolName"         element={<ToolDetailPage />} />
            <Route path="/documents"                            element={<DocumentsPage />} />
            <Route path="/scenarios"                            element={<ScenariosPage />} />
            <Route path="/scenarios/:scenarioId"                element={<ScenarioDetailPage />} />

            <Route path="/settings"      element={<SettingsPage />} />
            <Route path="/account"       element={<AccountPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/objects"       element={<ObjectsPage />} />
            <Route path="/projects"      element={<ProjectsPage />} />
            {/* Generic on purpose: a new application must not mean a new route. */}
            <Route path="/modules/:apiName" element={<ModulePage />} />
            <Route path="/modules/:apiName/edit" element={<ModuleBuilderPage />} />
            <Route path="/objects/:type" element={<ObjectListPage />} />
            <Route path="/objects/:type/:recordId" element={<CustomRecordPage />} />
            <Route path="/create-workflow" element={<CreateWorkflowGuide />} />
            {/* retired deep links live on as redirects */}
            <Route path="/graph"         element={<Navigate to="/objects" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/objects" replace />} />
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
