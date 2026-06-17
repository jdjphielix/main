# TaperPay Backoffice Frontend - Core Infrastructure

This directory contains the foundational React infrastructure for the TaperPay Backoffice system.

## Directory Structure

```
src/
├── contexts/          # React Context providers for global state
├── i18n/             # Internationalization (English & Dutch)
├── services/         # API clients and service layer
├── hooks/            # Custom React hooks
└── README.md         # This file
```

## Contexts

### `contexts/AuthContext.jsx`
Manages authentication state and operations.

**Features:**
- User and token state management
- Google OAuth login (`loginWithGoogle()`)
- Development login for testing (`devLogin(email)`)
- Automatic user fetch on mount (`fetchUser()`)
- Auth callback handling for OAuth redirect (`handleAuthCallback()`)
- Token stored in sessionStorage (not localStorage)
- Logout with session cleanup

**Usage:**
```jsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, token, isAuthenticated, loginWithGoogle, logout } = useAuth();
  // ...
}
```

### `contexts/ThemeContext.jsx`
Manages dark/light mode theming.

**Features:**
- Dark mode toggle
- Applies 'dark' class to document.documentElement
- Persists preference to sessionStorage
- Respects system preference on first load

**Usage:**
```jsx
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { isDarkMode, toggleDarkMode, isHydrated } = useTheme();
  // ...
}
```

### `contexts/NotificationContext.jsx`
Real-time notifications via WebSocket.

**Features:**
- WebSocket connection to `ws://localhost:8000/ws/{userId}`
- Notifications array state
- Unread count tracking
- Mark as read / Mark all read
- Delete notification
- Auto-reconnection with exponential backoff

**Usage:**
```jsx
import { useNotifications } from '@/contexts/NotificationContext';

function NotificationBell() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  // ...
}
```

## i18n

### `i18n/I18nProvider.jsx`
i18next wrapper component with browser language detection.

**Features:**
- Language auto-detection (sessionStorage → localStorage → browser)
- HTML lang attribute synchronization
- Support for English and Dutch

**Usage:**
```jsx
import { I18nProvider } from '@/i18n/I18nProvider';
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('dashboard.title')}</h1>;
}
```

### `i18n/en.json` & `i18n/nl.json`
Complete translation files for:
- Navigation items (Dashboard, Leads, Prospects, etc.)
- Common actions (Save, Cancel, Delete, Edit, Search, Filter, Export)
- Lead/Prospect/Call/Client fields
- Validation messages
- Status and pipeline stages
- Chat, notifications, and admin sections

## Services

### `services/api.js`
Axios-based API client with interceptors.

**Features:**
- Base URL from `VITE_API_URL` env or `/api/v1`
- Auth interceptor (adds Bearer token)
- 401 response interceptor (logs out user)
- Named API service objects:
  - `leadsApi` - Lead management
  - `prospectsApi` - Prospect management
  - `callbacksApi` - Callback scheduling & tracking
  - `documentsApi` - Document upload/download
  - `chatApi` - Chat messaging
  - `notificationsApi` - Notification management
  - `usersApi` - User profiles & preferences
  - `dashboardApi` - Dashboard metrics
  - `aiApi` - AI enrichment & insights
  - `adminApi` - Admin operations

**Usage:**
```jsx
import { leadsApi } from '@/services/api';

async function fetchLeads() {
  const response = await leadsApi.getLeads({ status: 'new' });
  return response.data;
}
```

## Hooks

### `hooks/useWebSocket.js`

#### `useWebSocket(url, onMessage, options)`
Generic WebSocket connection management.

**Features:**
- Auto-connect on mount (configurable)
- Auto-reconnection with configurable max attempts
- Message queueing while disconnected
- Message sending with state tracking
- Async message sending with timeout

**Options:**
- `reconnectInterval` (ms, default: 3000)
- `maxReconnectAttempts` (default: 5)
- `autoConnect` (default: true)

**Usage:**
```jsx
const { isConnected, send, onMessage } = useWebSocket('ws://localhost:8000', 
  (data) => console.log('Message:', data)
);

send({ type: 'ping' });
```

#### `useWebSocketSubscriptions(baseUrl, subscriptions)`
Topic-based subscription management.

**Usage:**
```jsx
const subscriptions = {
  'lead:updated': (payload) => console.log('Lead updated:', payload),
  'prospect:created': (payload) => console.log('New prospect:', payload),
};

const { subscribe, unsubscribe } = useWebSocketSubscriptions(
  'localhost:8000', 
  subscriptions
);

subscribe('lead:updated');
```

#### `useAuthenticatedWebSocket(baseUrl, userId, token, onMessage)`
WebSocket with automatic auth token handling.

**Usage:**
```jsx
const { isConnected, send } = useAuthenticatedWebSocket(
  'localhost:8000',
  userId,
  authToken,
  (data) => handleMessage(data)
);
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install axios i18next react-i18next i18next-browser-languagedetector
```

### 2. Wrap App with Providers
```jsx
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { I18nProvider } from '@/i18n/I18nProvider';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <I18nProvider>
            {/* Your app components */}
          </I18nProvider>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
```

### 3. Environment Variables
```env
VITE_API_URL=/api/v1  # Optional - defaults to /api/v1
```

## Authentication Flow

1. User visits app
2. AuthContext checks sessionStorage for token
3. If token exists, fetches user profile
4. On login:
   - Google: Redirects to `/api/v1/auth/google/login`
   - Dev: Calls `/api/v1/auth/dev/login` with email
5. Backend redirects to `/auth/callback?token=xxx`
6. AuthContext extracts token from URL and stores in sessionStorage
7. On logout: Clears token and redirects to `/`

## WebSocket Connections

**Notifications**: Automatically connects to `ws://localhost:8000/ws/{userId}` when authenticated.

**Custom Connections**: Use `useWebSocket`, `useWebSocketSubscriptions`, or `useAuthenticatedWebSocket` for other real-time features.

## Best Practices

- Always use `sessionStorage` for tokens (not localStorage) for security
- Handle 401 responses - auto-logout is built into API interceptor
- Use named API service objects for type safety and consistency
- Wrap async operations in error boundaries
- Use i18n for all user-facing text
- Test WebSocket reconnection scenarios
- Monitor unread notification count in UI

## Common Patterns

### Fetching Data with Auth
```jsx
import { useAuth } from '@/contexts/AuthContext';
import { leadsApi } from '@/services/api';
import { useEffect, useState } from 'react';

export function LeadsList() {
  const { isAuthenticated } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    leadsApi.getLeads()
      .then(res => setLeads(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (loading) return <div>Loading...</div>;
  return <div>{leads.length} leads</div>;
}
```

### Real-time Updates
```jsx
import { useNotifications } from '@/contexts/NotificationContext';
import { useEffect } from 'react';

export function NotificationBell() {
  const { unreadCount, markAllRead } = useNotifications();

  return (
    <button onClick={markAllRead}>
      Notifications ({unreadCount})
    </button>
  );
}
```

---

**Created**: 2026-04-02  
**For**: TaperPay Backoffice System  
**Status**: Production-ready
