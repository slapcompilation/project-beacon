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
const AccountPage = lazyWithRetry(() => import('@/pages/AccountPage'))
const ObjectTypesPage = lazyWithRetry(() => import('@/pages/ObjectTypesPage'))
const ObjectsPage = lazyWithRetry(() => import('@/pages/ObjectsPage'))
const ProjectsPage = lazyWithRetry(() => import('@/pages/ProjectsPage'))
const ObjectListPage = lazyWithRetry(() => import('@/pages/ObjectListPage'))
const CustomRecordPage = lazyWithRetry(() => import('@/pages/CustomRecordPage'))



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



            <Route path="/account"       element={<AccountPage />} />
            <Route path="/ontology"     element={<ObjectTypesPage />} />
            <Route path="/objects"       element={<ObjectsPage />} />
            <Route path="/projects"      element={<ProjectsPage />} />
            {/* Generic on purpose: a new application must not mean a new route. */}
            <Route path="/objects/:type" element={<ObjectListPage />} />
            <Route path="/objects/:type/:recordId" element={<CustomRecordPage />} />
            {/* retired deep links live on as redirects */}
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
