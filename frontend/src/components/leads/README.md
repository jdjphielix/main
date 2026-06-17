# Sales Leads - CRM Components

Premium luxury CRM interface for TaperPay Backoffice. Manage sales leads with AI-powered features, call tracking, and kanban workflow visualization.

## File Structure

```
frontend/src/
├── pages/
│   └── LeadsPage.jsx           # Main leads page (list/kanban views)
└── components/leads/
    ├── LeadTable.jsx           # Sortable table view
    ├── LeadKanban.jsx          # Status-based kanban columns
    ├── LeadDetailPopup.jsx     # Rich detail modal (7 tabs)
    ├── CallTimer.jsx           # Call duration tracking widget
    ├── DailyCallList.jsx       # Sidebar call list (drag & reorder)
    └── AIImportModal.jsx       # AI-powered bulk import
```

## Component Overview

### LeadsPage
Main page component managing:
- View mode toggle (list ↔ kanban)
- Global search and filtering
- Lead list with mock data (5 international trade companies)
- Floating action button to add leads
- Detail popup lifecycle
- Import/export functionality

**Props:** None (self-contained page)

### LeadTable
Sortable table view showing:
- Columns: Company, Contact, Mobile, Status, Priority, Score, Called, Daily List, Pin
- Sortable headers (click to toggle ascending/descending)
- Score circular progress indicator
- Status badge with color coding
- Quick action buttons (call, daily list toggle, pin)

**Props:**
- `leads` (array): Lead objects to display
- `onSelectLead` (function): Opens detail popup
- `onToggleDailyList` (function): Toggle daily call list
- `onPinLead` (function): Pin lead to sidebar

### LeadKanban
Kanban board view with status columns:
- 4 columns: New, Contacted, Callback, Interested
- Each card shows: company name, contact, AI score, priority
- Call status indicator
- Quick "Add to daily list" button
- Empty state message per column

**Props:** Same as LeadTable

### LeadDetailPopup
Rich modal detail view with 7 tabs:

1. **Overview** - Company/contact info, AI score, quick actions
2. **Call Log** - Previous calls, call timer widget
3. **Notes** - Scrollable notes with add form
4. **Communication** - Message thread with @mention support
5. **Emails** - Placeholder for email sync integration
6. **Documents** - Drag & drop upload, file list
7. **About** - AI company enrichment, details, re-enrich button

**Props:**
- `lead` (object): Lead data to display
- `onClose` (function): Close popup
- `onUpdate` (function): Persist lead changes

### CallTimer
Floating call timer widget:
- Elapsed time display (MM:SS format)
- Play/Pause/Resume controls
- Call outcome dropdown
- Quick notes field
- "Log Call" button

**Props:**
- `onLogCall` (function): Callback with duration, outcome, notes
- `onCancel` (function): Dismiss timer

### DailyCallList
Sidebar panel showing today's scheduled calls:
- Sorted by priority
- Drag & reorder functionality
- Click-to-call (tel: links)
- Call checkmark toggle
- Called vs remaining stats

**Props:**
- `leads` (array): Leads on daily call list

### AIImportModal
AI-powered bulk import modal:
- Drag & drop file upload (.xlsx, .csv, .pdf, .png, .jpg)
- AI processing animation
- Duplicate detection with warnings
- Import preview table
- Statistics (total, to import, duplicates)

**Props:**
- `onClose` (function): Close modal
- `onImport` (function): Import leads callback

## Design System

### Brand Colors (TaperPay)
- **Navy Primary:** `#011745`
- **Blue CTA:** `#3d61a4`
- **Navy Mid:** `#0a2d6b`
- **Off-white BG:** `#f7f8fc`
- **Gray-100 Border:** `#e8eaf2`
- **Gray-300 Text:** `#a4abbe`
- **Gray-500 Body:** `#566079`

### Status Colors
- **New:** `#3d61a4` (Navy Blue)
- **Contacted:** `#579bfc` (Light Blue)
- **Callback:** `#ff5ac4` (Pink)
- **Interested:** `#00c875` (Green)

### Priority Indicator Colors
- **Critical:** `#ff642e` (Orange)
- **High:** `#ffcb00` (Gold)
- **Medium:** `#9cd326` (Lime)
- **Low:** `#66ccff` (Cyan)

### Typography
- **Headings:** Plus Jakarta Sans (fallback: Inter)
- **Body:** Inter (fallback: system font)

## Mock Data

5 fictive international trade companies:

1. **Van der Berg International Trading BV** (Netherlands)
   - Status: New
   - Priority: High
   - Score: 85

2. **Meridian Commodities Ltd** (United Kingdom)
   - Status: Contacted
   - Priority: Critical
   - Score: 92

3. **Nordic Supply Chain AS** (Norway)
   - Status: Callback
   - Priority: Medium
   - Score: 72

4. **Grupo Exportador Ibérico SL** (Spain)
   - Status: Interested
   - Priority: High
   - Score: 88

5. **Rhein-Cargo Logistics GmbH** (Germany)
   - Status: New
   - Priority: Medium
   - Score: 68

## Features

### List View
- Sortable columns (click headers)
- Search by company, contact, email
- Status & priority filtering
- Call tracking (check/X indicators)
- Quick daily list toggle
- Pin to sidebar

### Kanban View
- Visual status workflow
- Drag-friendly card design
- Lead count per status
- Score progress circles
- Priority indicators

### Call Management
- Timer with pause/resume
- Call outcome tracking (completed, no answer, callback, busy, voicemail)
- Call notes
- Call history per lead
- Daily call list sidebar

### Lead Details
- Company enrichment
- AI lead score with reasoning
- Multi-tab interface
- Document upload & management
- Communication thread
- Note taking
- Email integration placeholder

### AI Features
- Bulk import with duplicate detection
- Lead enrichment (company size, revenue, growth stage)
- AI scoring algorithm
- Duplicate warning badges
- Smart file parsing (.xlsx, .csv, .pdf, images)

## Tailwind Utilities

All components use Tailwind CSS with custom TaperPay color palette:

```javascript
// Example utility classes used
className="bg-[#011745]"           // Navy background
className="text-[#3d61a4]"         // Blue text
className="border-[#e8eaf2]"       // Light border
className="hover:bg-[#0a2d6b]"     // Dark navy hover
className="focus:ring-[#eef2fa]"   // Blue focus ring
```

## Animation Classes

- `animate-slide-up` - Detail popup entrance
- `animate-spin` - Loading spinners
- Smooth transitions on all interactive elements

## Future Enhancements

- Real email/SMS integration
- Actual drag & drop reordering (react-beautiful-dnd)
- Backend API integration
- Real-time collaboration indicators
- Advanced filtering (date range, score range)
- Export to multiple formats
- Scheduled call reminders
- Call recording integration
- Video meeting integration

## Usage Example

```jsx
import LeadsPage from './pages/LeadsPage';

function App() {
  return <LeadsPage />;
}
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires Tailwind CSS 3.x

## Dependencies

- React 18+
- Tailwind CSS 3+
- lucide-react (icons)

## Notes

- All data is mock/in-memory. Backend integration required for persistence.
- Call timer does not persist across page reloads.
- File imports are simulated with mock parsing.
- Real email/document sync is placeholder UI only.
