import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { hasAccess } from './config/permissions'
import LoginPage from './pages/LoginPage'
import AuthCallback from './pages/AuthCallback'
import DashboardPage from './pages/DashboardPage'
import LeadsPage from './pages/LeadsPage'
import ProspectsPage from './pages/ProspectsPage'
import OnboardingPage from './pages/OnboardingPage'
import ClientsPage from './pages/ClientsPage'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'
import SalesDashboardPage from './pages/SalesDashboardPage'
import TeamManagementPage from './pages/TeamManagementPage'
import TeamOnboardingPage from './pages/TeamOnboardingPage'
// SalesClientsPage replaced with direct ClientsPage render
import TextInstructiePage from './pages/TextInstructiePage'
import LimitOrdersPage from './pages/LimitOrdersPage'
import TicketsPage from './pages/TicketsPage'
import MainLayout from './components/layout/MainLayout'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-offwhite dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-taper-blue/20 border-t-taper-blue rounded-full animate-spin" />
          <p className="text-gray-400 font-medium">Laden...</p>
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function RoleRoute({ path, children }) {
  const { user } = useAuth()
  if (!hasAccess(user, path)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/leads" element={<RoleRoute path="/leads"><LeadsPage /></RoleRoute>} />
                <Route path="/prospects" element={<RoleRoute path="/prospects"><ProspectsPage /></RoleRoute>} />
                <Route path="/onboarding" element={<RoleRoute path="/onboarding"><OnboardingPage /></RoleRoute>} />
                <Route path="/clients" element={<RoleRoute path="/clients"><ClientsPage /></RoleRoute>} />
                <Route path="/sales-clients" element={<RoleRoute path="/sales-clients"><ClientsPage myClientsOnly={true} /></RoleRoute>} />
                <Route path="/chat" element={<RoleRoute path="/chat"><ChatPage /></RoleRoute>} />
                <Route path="/admin" element={<RoleRoute path="/admin"><AdminPage /></RoleRoute>} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/sales-dashboard" element={<RoleRoute path="/sales-dashboard"><SalesDashboardPage /></RoleRoute>} />
                <Route path="/team-management" element={<RoleRoute path="/team-management"><TeamManagementPage /></RoleRoute>} />
                <Route path="/team-onboarding" element={<RoleRoute path="/team-onboarding"><TeamOnboardingPage /></RoleRoute>} />
                <Route path="/tekst-instructie" element={<RoleRoute path="/tekst-instructie"><TextInstructiePage /></RoleRoute>} />
                <Route path="/limit-orders" element={<RoleRoute path="/limit-orders"><LimitOrdersPage /></RoleRoute>} />
                <Route path="/tickets" element={<RoleRoute path="/tickets"><TicketsPage /></RoleRoute>} />
              </Routes>
            </MainLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
