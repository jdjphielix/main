# TaperPay Backoffice Layout Components

Professional, modern CRM layout components built with React, Tailwind CSS, and Taper brand colors.

## Components Created

### 1. **MainLayout.jsx**
Main layout wrapper that provides the overall structure for the backoffice.

**Location:** `/src/components/layout/MainLayout.jsx`

**Features:**
- Two-column layout: collapsible sidebar + main content area
- Top navigation bar with quick actions
- Responsive design (flex-based)
- Dark mode support via context
- Wraps all page content

**Usage:**
```jsx
import MainLayout from './components/layout/MainLayout';

<MainLayout>
  <YourPageContent />
</MainLayout>
```

**Props:** None (uses contexts)

**Dependencies:**
- `useAuth` - AuthContext
- `useTheme` - ThemeContext
- `useTranslation` - react-i18next

---

### 2. **Sidebar.jsx**
Collapsible navigation sidebar with Taper branding.

**Location:** `/src/components/layout/Sidebar.jsx`

**Features:**
- Navy (#011745) background with gradient styling
- Collapsible toggle (ChevronLeft icon)
- Navigation items with active state highlighting (Taper blue)
- Icons from lucide-react:
  - Dashboard (LayoutDashboard)
  - Leads (Users)
  - Prospects (Target)
  - Onboarding (ClipboardCheck) - disabled
  - Clients (Building2) - disabled
  - Chat (MessageSquare)
  - Admin (Settings) - admin-only
- Dark/Light mode toggle
- Language switcher (NL/EN)
- User profile section at bottom (avatar, name, role)
- Prominent Taper logo at top (min height 48px)
- Uses NavLink from react-router-dom for active states

**Styling:**
- Navy background: `bg-navy`
- Active nav item: `bg-taper-blue` with rounded corners
- Smooth collapse/expand animation: `transition-all duration-300`
- Rounded buttons: `rounded-xl`
- Shadows: `shadow-card`

**Props:**
```jsx
{
  isOpen: boolean,      // Sidebar open/closed state
  setIsOpen: function   // Setter for open state
}
```

---

### 3. **TopBar.jsx**
Top navigation bar with quick action buttons and user profile dropdown.

**Location:** `/src/components/layout/TopBar.jsx`

**Features:**
- Quick action buttons (left side):
  - "Nieuwe Lead" (Plus icon) - Taper blue
  - "Zoeken" (Search icon) - Blue light
  - "Mijn Bellijst" (Phone icon) - Blue light
  - "Callbacks Vandaag" (Calendar icon) - Blue light
- Right side controls:
  - Notification bell with unread count badge (red)
  - User profile dropdown with avatar
  - Logout button in dropdown
- Smooth animations on button interactions
- Dark mode support

**Styling:**
- White/gray background: `bg-white dark:bg-gray-800`
- Height: 80px (`h-20`)
- Quick action buttons styled with Taper colors
- Profile dropdown with hover effects

**Props:**
```jsx
{
  sidebarOpen: boolean,           // Is sidebar open
  setSidebarOpen: function        // Setter for sidebar state
}
```

---

### 4. **LoginPage.jsx**
Stunning login page with glass-morphism design.

**Location:** `/src/pages/LoginPage.jsx`

**Features:**
- Full-screen background video (globe-hero.mp4)
- Semi-transparent dark overlay
- Centered login card with glass-morphism effect (`backdrop-blur-xl`)
- Large square Taper logo (min 120px height)
- "Taper® Backoffice" heading
- Brand tagline: "Bringing back how banking should have been."
- Google Sign In button (styled with Taper blue)
- Development login section:
  - Email input (Mail icon)
  - Password input (Lock icon)
  - Dev login button
- Smooth animations with staggered delays
- Error message display
- Loading states on buttons

**Styling:**
- Card: `bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl`
- Shadow: `shadow-popup`
- Button animations: `animate-fade-in`, `animate-slide-up`
- Input fields: rounded blue focus ring
- Placeholder text in gray

**Video Path:** `/fotos/globe-hero.mp4`

**Logo Path:** `/branding/Logos/Taper - Logo - Vierkant - V3.png`

---

### 5. **AuthCallback.jsx**
OAuth callback handler for redirects from auth providers.

**Location:** `/src/pages/AuthCallback.jsx`

**Features:**
- Extracts auth token from URL query params
- Stores token in sessionStorage
- Calls auth context callback handler
- Displays loading state with spinner
- Redirects to dashboard on success
- Redirects to login on error

**Usage:**
Route: `/auth/callback?token=<TOKEN>`

---

### 6. **DashboardPage.jsx**
Main dashboard with KPIs, charts, and activity feeds.

**Location:** `/src/pages/DashboardPage.jsx`

**Features:**
- Welcome message: "Goedemorgen, {first_name}"
- KPI Cards (4-column grid):
  - Leads vandaag
  - Calls gemaakt
  - Pipeline waarde
  - Conversieratio
- Pipeline funnel visualization with colored bars
- Team targets progress bars
- Activity feed with 3 placeholder activities
- Quick stats card (gradient background)
- Responsive grid layout
- Recharts integration (prepared for charts)

**KPI Card Styling:**
- White cards with shadows
- Icon backgrounds in Taper colors
- Trend indicators in green
- Hover effect with popup shadow

**Activity Feed:**
- Icon + message + timestamp
- Placeholder states
- Smooth animations

---

## Tailwind Configuration Updates

### Extended Colors (tailwind.config.js)

**Taper Brand Colors:**
- `navy` - #011745 (navy-mid: #0a2d6b)
- `taper-blue` - #3d61a4
- `blue-light` - #5a7fc2
- `blue-pale` - #eef2fa
- `off-white` - #f7f8fc

**Extended Utilities:**
- `.text-gradient` - Gradient text effect
- `.glass` - Glass-morphism effect (light)
- `.glass-dark` - Glass-morphism effect (dark)
- `.truncate-2` / `.truncate-3` - Multi-line text truncation

**Animations:**
- `animate-fade-in` - Fade in 0.4s
- `animate-slide-up` - Slide up with fade 0.5s (forwards)
- `animate-pulse-soft` - Soft pulse 2s infinite

**Shadows:**
- `shadow-card` - Light card shadow
- `shadow-popup` - Strong popup shadow

---

## Design Tokens & Brand Styling

### Colors

**Primary Colors:**
- Navy: `#011745` (backgrounds, headers)
- Taper Blue: `#3d61a4` (CTAs, active states)
- Blue Light: `#5a7fc2` (hover states)

**Background:**
- Off-white: `#f7f8fc` (never pure white)
- Blue Pale: `#eef2fa` (light sections)

**Neutrals:**
- Gray-50 to Gray-900 (full grayscale)

### Typography

**Fonts:**
- Headings: Plus Jakarta Sans (fallback: Inter)
- Body: Inter (fallback: -apple-system)

### Spacing & Borders

- Rounded corners: `rounded-2xl` (16px), `rounded-3xl` (24px)
- Padding standard: `p-6`, `p-8`
- Gap standard: `gap-6`

### Shadows

- Card: `0 2px 8px rgba(1, 23, 69, 0.08)`
- Popup: `0 12px 32px rgba(1, 23, 69, 0.12)`

---

## Context Requirements

### AuthContext
Provides:
- `user` - Current user object
- `token` - Auth token
- `loading` - Loading state
- `error` - Error message
- `loginWithGoogle()` - Google OAuth login
- `devLogin(email)` - Dev login
- `logout()` - Logout
- `isAuthenticated` - Boolean

### ThemeContext
Provides:
- `isDarkMode` - Current theme state
- `toggleDarkMode()` - Toggle dark/light
- `setDarkMode(value)` - Set explicit theme
- `isHydrated` - Theme loaded state

### react-i18next
Provides:
- `t(key, defaultValue)` - Translation function
- `i18n.language` - Current language
- `i18n.changeLanguage(lang)` - Change language

---

## Responsive Design

All components use Tailwind's responsive utilities:

- **Mobile:** Base styles
- **Tablet:** `md:` prefix (768px+)
- **Desktop:** `lg:` prefix (1024px+)

**Sidebar:** Collapses to icon-only on mobile
**Top Bar:** Hides secondary elements on mobile
**Dashboard:** 1 column mobile, 2 columns tablet, full grid desktop

---

## Accessibility Features

- Semantic HTML
- ARIA labels on buttons
- Keyboard navigation support
- Focus rings on interactive elements
- Proper color contrast ratios
- Dark mode support for reduced eye strain

---

## File Paths Summary

```
/src/
├── components/
│   └── layout/
│       ├── MainLayout.jsx
│       ├── Sidebar.jsx
│       └── TopBar.jsx
├── pages/
│   ├── LoginPage.jsx
│   ├── AuthCallback.jsx
│   └── DashboardPage.jsx
└── contexts/
    ├── AuthContext.jsx
    └── ThemeContext.jsx

tailwind.config.js (updated with Taper colors)
```

---

## Usage Example

```jsx
// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/dashboard" element={
              <MainLayout>
                <DashboardPage />
              </MainLayout>
            } />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
```

---

## Notes for Development

1. **Logo Images:** Ensure logo files exist at:
   - `/branding/Logos/Taper - Logo - Horizontaal - V3.png` (sidebar)
   - `/branding/Logos/Taper - Logo - Vierkant - V3.png` (login page)

2. **Video Background:** Place at:
   - `/fotos/globe-hero.mp4`

3. **Internationalization:** All UI strings use i18n with Dutch fallbacks.

4. **Dark Mode:** Automatically respects system preference on first load, stored in sessionStorage.

5. **Auth Flow:**
   - Google OAuth: Redirects to `/api/v1/auth/google/login`
   - Dev Login: POST to `/api/v1/auth/dev/login` with email
   - Callback: Expects token in URL params at `/auth/callback?token=...`

---

## License & Brand

Built for TaperPay. All brand colors, typography, and logos are proprietary Taper assets.
