import { lazy, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router'
import Layout from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import LoginPage from '@/auth/LoginPage'
import LandingPage from '@/pages/LandingPage'
import Dashboard from '@/pages/Dashboard'
import VerifyDocumentPage from '@/pages/VerifyDocumentPage'
import { verifyAuth } from '@/auth/session'

function RootGate() {
  const [state, setState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  useEffect(() => {
    verifyAuth().then((ok) => setState(ok ? 'authenticated' : 'unauthenticated'))
  }, [])

  if (state === 'loading') return null
  if (state === 'authenticated') return <Navigate to="/dashboard" replace />
  return <LandingPage />
}

// Everything below is code-split per feature so a viewer-role user loading
// /dashboard doesn't also pay for finance, reports, and admin bundles.
const PlatformAdmin = lazy(() => import('@/pages/PlatformAdmin'))
const RecordsPage = lazy(() => import('@/features/records/RecordsPage'))
const ResidentsPage = lazy(() => import('@/features/residents/ResidentsPage'))
const HouseholdsPage = lazy(() => import('@/features/households/HouseholdsPage'))
const DeceasedRecordsPage = lazy(() => import('@/features/deceased/DeceasedRecordsPage'))
const DocumentsPage = lazy(() => import('@/features/documents/DocumentsPage'))
const ReleasePage = lazy(() => import('@/features/documents/ReleasePage'))
const SystemSettings = lazy(() => import('@/features/settings/SystemSettings'))
const ActivityPage = lazy(() => import('@/features/logs/ActivityPage'))
const VisitorLogPage = lazy(() => import('@/features/logs/VisitorLogPage'))
const AssetsPage = lazy(() => import('@/features/assets/AssetsPage'))
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'))
const AgendaPage = lazy(() => import('@/features/agenda/AgendaPage'))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'))
const BudgetOverview = lazy(() => import('@/features/finance/BudgetOverview').then((m) => ({ default: m.BudgetOverview })))
const Appropriations = lazy(() => import('@/features/finance/Appropriations').then((m) => ({ default: m.Appropriations })))
const RevenueTracking = lazy(() => import('@/features/finance/RevenueTracking').then((m) => ({ default: m.RevenueTracking })))
const FundSources = lazy(() => import('@/features/finance/FundSources').then((m) => ({ default: m.FundSources })))
const Disbursements = lazy(() => import('@/features/finance/Disbursements').then((m) => ({ default: m.Disbursements })))
const FinanceAudit = lazy(() => import('@/features/finance/FinanceAudit').then((m) => ({ default: m.FinanceAudit })))
const GovernmentFormsPage = lazy(() => import('@/features/government-forms/GovernmentFormsPage'))

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootGate />} />
      <Route path="/login" element={<LoginPage />} />
      {/* Public — no auth required. Reached by scanning the QR code printed
          on a released document certificate (see certificatePdf.ts). */}
      <Route path="/verify/:id" element={<VerifyDocumentPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route
          path="platform-admin"
          element={
            <ProtectedRoute requirePlatformAdmin>
              <PlatformAdmin />
            </ProtectedRoute>
          }
        />
        <Route
          path="records"
          element={
            <ProtectedRoute roles={['admin', 'staff', 'viewer']}>
              <RecordsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute roles={['admin']}>
              <SystemSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="residents"
          element={
            <ProtectedRoute roles={['admin', 'staff', 'viewer']}>
              <ResidentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="households"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <HouseholdsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="deceased"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <DeceasedRecordsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="documents"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <DocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="documents/release"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <ReleasePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="logs/activity"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <ActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="logs/visitors"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <VisitorLogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="assets"
          element={
            <ProtectedRoute roles={['admin']}>
              <AssetsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="calendar"
          element={
            <ProtectedRoute roles={['admin', 'staff', 'viewer']}>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="agenda"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <AgendaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/budget"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <BudgetOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/appropriations"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <Appropriations />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/revenues"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <RevenueTracking />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/funds"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <FundSources />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/disbursements"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <Disbursements />
            </ProtectedRoute>
          }
        />
        <Route
          path="finance/audit"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <FinanceAudit />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="government-forms"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <GovernmentFormsPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}
