# App Setup Guide - TaperPay Backoffice Layout

Example implementation of the layout components in your main App.jsx.

## Basic Setup

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './components/layout/MainLayout';

// Pages
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected Routes with MainLayout */}
            <Route path="/dashboard" element={
              <MainLayout>
                <DashboardPage />
              </MainLayout>
            } />

            {/* Add more protected routes here */}
            {/* <Route path="/leads" element={
              <MainLayout>
                <LeadsPage />
              </MainLayout>
            } /> */}

            {/* Catch-all redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
```

## With Protected Route Wrapper

For better auth handling, create a ProtectedRoute component:

```jsx
// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainLayout from './layout/MainLayout';
import { Loader } from 'lucide-react';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-off-white dark:bg-gray-900">
        <Loader className="animate-spin text-taper-blue" size={48} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
};

export default ProtectedRoute;
```

Then use it in routes:

```jsx
// src/App.jsx
import ProtectedRoute from './components/ProtectedRoute';

// ... inside Routes:
<Route path="/dashboard" element={
  <ProtectedRoute>
    <DashboardPage />
  </ProtectedRoute>
} />
```

## With React Query Integration

```jsx
// src/App.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            {/* Routes here */}
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

## With Error Boundary

```jsx
// src/components/ErrorBoundary.jsx
import React from 'react';
import { AlertCircle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-off-white dark:bg-gray-900">
          <div className="text-center space-y-4">
            <AlertCircle size={48} className="text-red-500 mx-auto" />
            <h1 className="text-2xl font-heading font-bold text-navy dark:text-white">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Please refresh the page or contact support.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-6 px-6 py-3 bg-taper-blue text-white rounded-lg hover:bg-blue-light transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

## Full App.jsx with All Features

```jsx
// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import DashboardPage from './pages/DashboardPage';
// import LeadsPage from './pages/LeadsPage';
// import ProspectsPage from './pages/ProspectsPage';
// import ChatPage from './pages/ChatPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/callback" element={<AuthCallback />} />

                {/* Protected Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />

                {/* TODO: Add more protected routes */}
                {/* <Route
                  path="/leads"
                  element={
                    <ProtectedRoute>
                      <LeadsPage />
                    </ProtectedRoute>
                  }
                /> */}

                {/* Catch-all */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
```

## main.jsx (Entry Point)

```jsx
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // Make sure Tailwind CSS is imported
import './i18n'; // Import i18n configuration

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

## index.css

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Global font imports - make sure these are loaded in your HTML head */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

/* Smooth scroll behavior */
html {
  scroll-behavior: smooth;
}

/* Prevent body scroll when modals are open */
body.modal-open {
  overflow: hidden;
}

/* Remove default focus outline (we'll use Tailwind's) */
button:focus,
input:focus,
select:focus,
textarea:focus {
  outline: none;
}

/* Smooth transitions globally */
* {
  @apply transition-colors duration-200;
}

/* Selection styling */
::selection {
  @apply bg-taper-blue text-white;
}
```

## i18n Configuration Example

```jsx
// src/i18n/index.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import nlTranslations from './locales/nl.json';
import enTranslations from './locales/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'nl',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    resources: {
      nl: { translation: nlTranslations },
      en: { translation: enTranslations },
    },
  });

export default i18n;
```

```json
// src/i18n/locales/nl.json
{
  "nav": {
    "dashboard": "Dashboard",
    "leads": "Leads",
    "prospects": "Prospects",
    "onboarding": "Onboarding",
    "clients": "Clients",
    "chat": "Chat",
    "admin": "Admin"
  },
  "topbar": {
    "newLead": "Nieuwe Lead",
    "search": "Zoeken",
    "myCallList": "Mijn Bellijst",
    "callbacksToday": "Callbacks Vandaag",
    "myProfile": "Mijn Profiel",
    "logout": "Uitloggen"
  },
  "login": {
    "backoffice": "Backoffice",
    "tagline": "Bringing back how banking should have been.",
    "googleSignIn": "Continue with Google",
    "orDevMode": "Development",
    "email": "Email",
    "password": "Password",
    "devLogin": "Dev Login",
    "secureConnection": "Secure connection • Encrypted data",
    "emailRequired": "Email is required",
    "googleError": "Google sign-in failed. Please try again.",
    "loginError": "Login failed. Please try again."
  },
  "dashboard": {
    "goodMorning": "Goedemorgen",
    "welcomeMessage": "Hier is jouw dashboard overzicht voor vandaag",
    "leadsToday": "Leads Vandaag",
    "callsMade": "Calls Gemaakt",
    "pipelineValue": "Pipeline Waarde",
    "conversionRate": "Conversieratio",
    "leads": "Leads",
    "prospects": "Prospects",
    "onboarding": "Onboarding",
    "clients": "Clients",
    "pipelineFunnel": "Sales Funnel",
    "teamTargets": "Team Targets",
    "recentActivity": "Recente Activiteiten",
    "noActivity": "Geen recente activiteiten",
    "quickStats": "Quick Stats",
    "avgDealSize": "Avg Deal Size",
    "salesCycle": "Sales Cycle",
    "nextCallback": "Next Callback"
  },
  "common": {
    "dark": "Dark",
    "light": "Light"
  }
}
```

## Environment Variables (.env)

```env
# src/.env
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

## Vite Configuration (if using Vite)

```jsx
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
});
```

## Package Dependencies

Required packages:
```bash
npm install react react-dom react-router-dom
npm install tailwindcss postcss autoprefixer
npm install lucide-react
npm install recharts
npm install i18next react-i18next i18next-browser-languagedetector
npm install @tanstack/react-query
```

Dev dependencies:
```bash
npm install -D @types/react @types/react-dom
npm install -D vite
```

## Next Steps

1. Copy this App setup structure
2. Create the additional page components (LeadsPage, ProspectsPage, ChatPage)
3. Set up your backend API endpoints
4. Configure Google OAuth credentials
5. Add real data fetching with React Query
6. Implement form handling and validation
7. Add toast notifications for user feedback
8. Set up error logging and monitoring

## Folder Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── MainLayout.jsx
│   │   ├── Sidebar.jsx
│   │   └── TopBar.jsx
│   ├── ProtectedRoute.jsx
│   └── ErrorBoundary.jsx
├── contexts/
│   ├── AuthContext.jsx
│   └── ThemeContext.jsx
├── pages/
│   ├── LoginPage.jsx
│   ├── AuthCallback.jsx
│   ├── DashboardPage.jsx
│   ├── LeadsPage.jsx (TODO)
│   ├── ProspectsPage.jsx (TODO)
│   └── ChatPage.jsx (TODO)
├── i18n/
│   └── locales/
│       ├── nl.json
│       └── en.json
├── App.jsx
├── main.jsx
└── index.css
```
