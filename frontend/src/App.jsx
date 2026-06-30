import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
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
import SalesClientsPage from './pages/SalesClientsPage'
import TextInstructiePage from './pages/TextInstructiePage'
import LimitOrdersPage from './pages/LimitOrdersPage'
import MainLayout from './components/layout/MainLayout'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-offwhite dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-taper-blue/20 border-t-taper-blue rounded-full animate-spin" />
          <p className="text-gray-400 font-medium">Loading...</p>
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
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
                <Route path="/leads" element={<LeadsPage />} />
                <Route path="/prospects" element={<ProspectsPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/sales-clients" element={<SalesClientsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/sales-dashboard" element={<SalesDashboardPage />} />
                <Route path="/team-management" element={<TeamManagementPage />} />
                <Route path="/tekst-instructie" element={<TextInstructiePage />} />
                <Route path="/limit-orders" element={<LimitOrdersPage />} />
              </Routes>
            </MainLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
