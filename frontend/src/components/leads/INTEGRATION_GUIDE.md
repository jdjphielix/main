# Sales Leads - Integration Guide

## Quick Start

### 1. Installation
No additional packages needed beyond your existing React + Tailwind setup.

```bash
# Ensure you have these core dependencies
npm install react tailwind lucide-react
```

### 2. Tailwind Configuration
Make sure your `tailwind.config.js` includes the content paths:

```javascript
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'taper-navy': '#011745',
        'taper-blue': '#3d61a4',
        'taper-navy-mid': '#0a2d6b',
        'taper-offwhite': '#f7f8fc',
        'taper-gray-100': '#e8eaf2',
        // ... add other colors
      },
      fontFamily: {
        'plus-jakarta': ['Plus Jakarta Sans', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
}
```

### 3. Add to Router
In your main routing file (e.g., `App.jsx` or `routes.js`):

```jsx
import LeadsPage from './pages/LeadsPage';

const routes = [
  // ... other routes
  {
    path: '/leads',
    element: <LeadsPage />,
  },
];
```

### 4. Navigation Link
Add a link in your main navigation:

```jsx
<NavLink to="/leads" className="nav-item">
  <Users size={20} />
  Sales Leads
</NavLink>
```

## Component Integration Details

### LeadsPage
- **Location:** `/frontend/src/pages/LeadsPage.jsx`
- **Self-contained:** Yes - manages all state and sub-components
- **Dependencies:** All lead sub-components
- **State Management:** Local React state (consider Redux for production)
- **Props:** None (entry point)

### State Management Pattern
Current implementation uses React `useState`. For production, consider:

```jsx
// Option 1: Redux (recommended for scaling)
const dispatch = useDispatch();
const leads = useSelector(state => state.leads.data);

// Option 2: Context API
const { leads, updateLead } = useLeadsContext();

// Option 3: TanStack Query (for backend sync)
const { data: leads } = useQuery(['leads'], fetchLeads);
```

## Backend Integration Checklist

### API Endpoints Needed

```
GET    /api/leads              # List all leads (with filtering)
POST   /api/leads              # Create new lead
GET    /api/leads/:id          # Get lead detail
PUT    /api/leads/:id          # Update lead
DELETE /api/leads/:id          # Delete lead

POST   /api/leads/:id/notes    # Add note
POST   /api/leads/:id/calls    # Log call
POST   /api/leads/import       # AI bulk import
POST   /api/leads/export       # Export to CSV/Excel

GET    /api/leads/:id/emails   # Get synced emails
GET    /api/leads/:id/documents # Get documents
POST   /api/leads/:id/documents # Upload document
```

### Data Model

```javascript
// Lead object structure
{
  id: string,
  company: string,
  website: string,
  country: string,
  industry: string,

  // Contact info
  contactName: string,
  email: string,
  phone: string,
  mobile: string,
  position: string,

  // Status & scoring
  status: 'New' | 'Contacted' | 'Callback' | 'Interested',
  priority: 'Critical' | 'High' | 'Medium' | 'Low',
  score: number (0-100),

  // Call tracking
  called: boolean,
  lastCall: Date | null,
  callDuration: number (minutes),
  onDailyList: boolean,

  // Related data
  notes: [{ id, text, date }],
  documents: [{ id, name, size, date, type }],
  emails: [],

  // Metadata
  createdAt: Date,
  updatedAt: Date,
  assignedTo: string (user ID),
}
```

## Authentication & Permissions

Add authentication checks to components:

```jsx
// In LeadsPage.jsx - protect the page
useEffect(() => {
  if (!isAuthenticated) {
    navigate('/login');
  }
  if (!hasPermission('leads:read')) {
    navigate('/unauthorized');
  }
}, [isAuthenticated, hasPermission]);
```

## Performance Optimization

### Recommended for Production

1. **Memoization:**
```jsx
const LeadTable = React.memo(({ leads, onSelectLead }) => {
  // Component code
}, (prev, next) => {
  return prev.leads.length === next.leads.length;
});
```

2. **Virtualization (for large lists):**
```jsx
import { FixedSizeList } from 'react-window';
// Wrap LeadTable rows in virtualized list
```

3. **Pagination:**
```jsx
// Replace infinite scroll with pagination
const [page, setPage] = useState(1);
const leads = usePaginatedLeads(page, pageSize);
```

4. **Code Splitting:**
```jsx
const LeadDetailPopup = React.lazy(() => import('./LeadDetailPopup'));
const AIImportModal = React.lazy(() => import('./AIImportModal'));
```

## Styling Customization

### Override Theme Colors
Create a custom theme file:

```css
/* src/styles/leads-theme.css */
:root {
  --color-navy: #011745;
  --color-blue: #3d61a4;
  --color-offwhite: #f7f8fc;
  --color-gray-100: #e8eaf2;
  --color-gray-500: #566079;
}

/* Or in Tailwind config */
theme: {
  extend: {
    colors: {
      'taper': {
        'navy': '#011745',
        'blue': '#3d61a4',
        'offwhite': '#f7f8fc',
      }
    }
  }
}
```

### Custom Breakpoints (if needed)
```jsx
// Responsive adjustments already included
// Uses Tailwind's default breakpoints
```

## Error Handling

Add error boundaries:

```jsx
import ErrorBoundary from './components/ErrorBoundary';

<ErrorBoundary fallback={<LeadsErrorPage />}>
  <LeadsPage />
</ErrorBoundary>
```

## Testing

Example test structure:

```javascript
// LeadTable.test.jsx
import { render, screen } from '@testing-library/react';
import LeadTable from './LeadTable';

describe('LeadTable', () => {
  it('renders leads', () => {
    const leads = [{ id: '1', company: 'Test Co' }];
    render(<LeadTable leads={leads} />);
    expect(screen.getByText('Test Co')).toBeInTheDocument();
  });

  it('sorts by column', () => {
    // Test sort functionality
  });

  it('opens detail popup', () => {
    // Test selection
  });
});
```

## Accessibility (a11y)

Components include:
- Semantic HTML (`<button>`, `<input>`, etc.)
- ARIA labels on interactive elements
- Keyboard navigation support (in progress)
- Color contrast compliance

### Enhance Accessibility:
```jsx
<button
  onClick={handleClick}
  aria-label="Open lead details"
  aria-pressed={isOpen}
  role="tab"
>
  Details
</button>
```

## Deployment Checklist

- [ ] Remove mock data (use real API)
- [ ] Add authentication
- [ ] Configure API endpoints
- [ ] Enable error logging (Sentry, etc.)
- [ ] Add analytics tracking
- [ ] Set up file upload handling
- [ ] Configure email/SMS services
- [ ] Performance testing (Lighthouse, WebPageTest)
- [ ] Security audit (OWASP Top 10)
- [ ] Accessibility audit (axe, WAVE)
- [ ] Cross-browser testing
- [ ] Mobile responsiveness testing

## Common Customizations

### Change Primary Color
Update all instances of `#3d61a4` to your color:
```bash
# Find and replace
grep -r "#3d61a4" src/components/leads/
```

### Add New Status
1. Update status options in `LeadsPage.jsx`
2. Add color in `statusColors` object
3. Update column filtering logic

### Add New Lead Field
1. Update mock data structure
2. Add column to `LeadTable`
3. Add field to `LeadDetailPopup`
4. Update API model

### Change Daily Call List Behavior
Edit `DailyCallList.jsx`:
- Modify sort order
- Add/remove filtering
- Adjust drag & drop behavior

## Troubleshooting

### Common Issues

**Issue:** Tailwind styles not applying
- Solution: Rebuild Tailwind CSS, check config content paths

**Issue:** Icons not showing
- Solution: Ensure `lucide-react` is installed, check import paths

**Issue:** Detail popup closes unexpectedly
- Solution: Check event bubbling (use `e.stopPropagation()`)

**Issue:** Duplicate detection not working
- Solution: Verify field matching logic in `AIImportModal.jsx`

## Support & Maintenance

- Monitor bundle size (Webpack Bundle Analyzer)
- Keep React and Tailwind updated
- Regular accessibility audits
- User feedback collection
- Performance monitoring (Sentry, New Relic)

## Next Steps

1. **Backend Integration:** Connect to your API
2. **Email/Calendar:** Integrate with Gmail/Outlook
3. **Document Management:** Add S3/GCS integration
4. **Advanced Analytics:** Track lead source, conversion rates
5. **Mobile App:** React Native version
6. **Team Collaboration:** Real-time sync, notifications
7. **AI Enhancements:** Lead scoring ML model, auto-enrichment
