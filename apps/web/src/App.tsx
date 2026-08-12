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
const HomePage = lazyWithRetry(() => import('@/pages/HomePage'))
const AccountPage = lazyWithRetry(() => import('@/pages/AccountPage'))
const ProjectsPage = lazyWithRetry(() => import('@/pages/ProjectsPage'))
const DatasetsPage = lazyWithRetry(() => import('@/pages/DatasetsPage'))
const ValueTypesPage = lazyWithRetry(() => import('@/pages/ValueTypesPage'))
const ProposalsPage = lazyWithRetry(() => import('@/pages/ontology/ProposalsPage'))
const MainBranchUpdatesPage = lazyWithRetry(() => import('@/pages/ontology/MainBranchUpdatesPage'))
const BranchesPage = lazyWithRetry(() => import('@/pages/BranchesPage'))

// Object Explorer: the search-and-analysis surface over the object index.
const ExplorerHome = lazyWithRetry(() => import('@/features/explorer/ExplorerHome'))
const ExplorationPage = lazyWithRetry(() => import('@/features/explorer/ExplorationPage'))
const SavedSetPage = lazyWithRetry(() => import('@/features/explorer/SavedSetPage'))
const LineagePage = lazyWithRetry(() => import('@/features/lineage/LineagePage'))

// Ontology Manager: its own chrome, and its resource pages inside it.
const OmaLayout = lazyWithRetry(() => import('@/features/ontologyManager/OmaLayout'))
const DiscoverPage = lazyWithRetry(() => import('@/pages/ontology/DiscoverPage'))
const ObjectTypesPage = lazyWithRetry(() => import('@/pages/ontology/ObjectTypesPage'))
const SharedPropertiesPage = lazyWithRetry(() => import('@/pages/ontology/SharedPropertiesPage'))
const LinkTypesPage = lazyWithRetry(() => import('@/pages/ontology/LinkTypesPage'))
const ActionTypesPage = lazyWithRetry(() => import('@/pages/ontology/ActionTypesPage'))
const InterfacesPage = lazyWithRetry(() => import('@/pages/ontology/InterfacesPage'))



function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Spinner size={SpinnerSize.LARGE} intent={Intent.PRIMARY} />
    </div>
  )
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
            {/* "Home: Return to your organization's landing page." */}
            <Route path="/"          element={<HomePage />} />
            <Route path="/account"   element={<AccountPage />} />
            <Route path="/ontology"  element={<OmaLayout />}>
              {/* "The Discover view offers a highly customizable landing page." */}
              <Route index element={<DiscoverPage />} />
              <Route path="object-types"      element={<ObjectTypesPage />} />
              <Route path="shared-properties" element={<SharedPropertiesPage />} />
              <Route path="link-types"        element={<LinkTypesPage />} />
              <Route path="action-types"      element={<ActionTypesPage />} />
              <Route path="interfaces"        element={<InterfacesPage />} />
              <Route path="proposals"         element={<ProposalsPage />} />
              <Route path="main-branch-updates" element={<MainBranchUpdatesPage />} />
            </Route>
            <Route path="/projects"  element={<ProjectsPage />} />
            <Route path="/datasets"  element={<DatasetsPage />} />
            <Route path="/value-types" element={<ValueTypesPage />} />
            <Route path="/branches" element={<BranchesPage />} />
            <Route path="/explorer" element={<ExplorerHome />} />
            <Route path="/explorer/saved/:setId" element={<SavedSetPage />} />
            <Route path="/explorer/:typeId" element={<ExplorationPage />} />
            <Route path="/lineage" element={<LineagePage />} />
            <Route path="/lineage/:kind/:id" element={<LineagePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
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
