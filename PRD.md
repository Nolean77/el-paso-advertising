# El Paso Advertising Solutions - Client Content Approval Portal

A bilingual client portal for digital marketing content approval, allowing clients to review scheduled posts, approve designs, track performance metrics, and submit new content requests.

**Experience Qualities**:
1. **Professional** - Polished interface that inspires confidence in the agency's capabilities
2. **Efficient** - Streamlined workflows for quick content approvals and feedback
3. **Transparent** - Clear visibility into content calendar, performance metrics, and request status

**Complexity Level**: Light Application (multiple features with basic state)
This portal manages multiple interconnected features (calendar, approvals, performance, requests) with user authentication and persistent state across tabs, making it more than a single-purpose tool but not requiring complex multi-view architecture.

## Essential Features

### Client Authentication
- **Functionality**: Email and password login with session persistence
- **Purpose**: Secure client access to their content and data
- **Trigger**: User visits portal and enters credentials
- **Progression**: Landing page → Enter email/password → Validate credentials → Redirect to dashboard
- **Success criteria**: Successful login persists across sessions, invalid credentials show error message

### Content Calendar View
- **Functionality**: Display upcoming scheduled social media posts in card grid format
- **Purpose**: Give clients visibility into their content pipeline
- **Trigger**: User clicks "Content Calendar" tab
- **Progression**: Tab click → Load scheduled posts → Display cards with date/platform/preview
- **Success criteria**: Posts appear chronologically, platform icons visible, preview images load correctly

### Content Approval Workflow
- **Functionality**: Review and approve/reject post designs with optional feedback
- **Purpose**: Enable client feedback loop for content refinement
- **Trigger**: User clicks "Approvals" tab
- **Progression**: Tab click → View pending posts → Click approve/request changes → Add comment (optional) → Submit decision
- **Success criteria**: Approval state persists, comments saved, visual confirmation of action

### Performance Metrics Dashboard
- **Functionality**: Display engagement metrics with visual charts
- **Purpose**: Demonstrate ROI and content effectiveness to clients
- **Trigger**: User clicks "Performance" tab
- **Progression**: Tab click → Load historical post data → Render charts showing reach/likes/engagement
- **Success criteria**: Charts render clearly, metrics update based on data, responsive to different screen sizes

### Content Request Submission
- **Functionality**: Form for submitting new content ideas with status tracking
- **Purpose**: Streamline client communication for new projects
- **Trigger**: User clicks "Requests" tab
- **Progression**: Tab click → Fill form (title/description/type) → Submit → View in status tracker
- **Success criteria**: Form validates, submission appears in tracker, status updates visible

## Edge Case Handling
- **Empty States**: Show helpful messages when no content exists (e.g., "No pending approvals" with illustration)
- **Invalid Login**: Display clear error message in both languages without exposing security details
- **Network Delays**: Show loading skeletons during data fetches
- **Missing Preview Images**: Fallback to platform icon or placeholder graphic
- **Long Comments**: Truncate with "read more" expansion for approval feedback
- **Language Switching**: Preserve current tab and data when toggling English/Spanish

## Design Direction
The design should evoke sophistication, trust, and Southwest regional pride. Dark backgrounds create a premium feel while gold accents add warmth and energy. The interface should feel like a high-end agency dashboard—modern, clean, with subtle animations that enhance rather than distract.

## Color Selection
A bold, sophisticated dark theme with premium gold accents that reflect the El Paso Advertising brand identity.

- **Primary Color**: Deep Black (#0a0a0a / oklch(0.06 0 0)) - Premium, sophisticated foundation
- **Secondary Colors**: 
  - Zinc-900 (oklch(0.15 0 0)) - Card backgrounds and elevated surfaces
  - Zinc-800 (oklch(0.20 0 0)) - Borders and subtle dividers
- **Accent Color**: Amber-500 (#f59e0b / oklch(0.75 0.15 70)) - Warm, energetic highlight for CTAs and success states
- **Foreground/Background Pairings**:
  - Background (Deep Black #0a0a0a): White text (#ffffff) - Ratio 19.5:1 ✓
  - Zinc-900 Cards (oklch(0.15 0 0)): White text - Ratio 16.8:1 ✓
  - Accent (Amber #f59e0b): Black text (#0a0a0a) - Ratio 8.2:1 ✓
  - Muted text: Zinc-400 (oklch(0.60 0 0)) on black - Ratio 7.8:1 ✓

## Font Selection
Typography should convey modern professionalism with excellent readability for both English and Spanish text, using geometric sans-serifs that feel contemporary and authoritative.

- **Typographic Hierarchy**:
  - H1 (Brand/Page Title): Inter Bold/32px/tight tracking (-0.02em)
  - H2 (Section Headers): Inter Semibold/24px/normal tracking
  - H3 (Card Titles): Inter Medium/18px/normal tracking
  - Body (Content): Inter Regular/16px/relaxed leading (1.6)
  - Small (Metadata): Inter Regular/14px/normal leading
  - Labels: Inter Medium/14px/slight tracking (0.01em)

## Animations
Animations should feel precise and premium—quick micro-interactions that provide feedback without delay. Use subtle elevation changes on hover, smooth tab transitions, and satisfying approval button states.

- **Micro-interactions**: Button hover states with 150ms scale (1.02x) and glow effect on accent buttons
- **Tab Switching**: 300ms crossfade with slight slide (16px) for content area
- **Card Loading**: Skeleton pulse animation with shimmer effect
- **Approval Actions**: Success confirmation with 200ms scale bounce and check icon fade-in
- **Chart Rendering**: Staggered bar/line animation on mount (400ms with easing)

## Component Selection
- **Components**:
  - `Tabs` - Navigation between Content Calendar, Approvals, Performance, Requests
  - `Card` - Container for posts, approvals, metrics cards
  - `Button` - Approve/reject actions, form submissions, login CTA
  - `Input` - Email, password fields, request form inputs
  - `Textarea` - Comment box for change requests, request descriptions
  - `Badge` - Platform indicators (Instagram, Facebook), status labels (Pending, Approved, Scheduled)
  - `Avatar` - Client profile display in header
  - `Label` - Form field labels in both languages
  - `Separator` - Visual breaks between sections
  - `Select` - Platform filter, request type selection
  - `Progress` - Loading states, engagement metrics visualization
  - `Alert` - Error messages, success confirmations

- **Customizations**:
  - Custom language toggle component (English/Spanish switch)
  - Custom metric chart cards using recharts with branded color scheme
  - Platform icon components (Instagram, Facebook, Twitter, LinkedIn)
  - Status indicator component with color-coded dots

- **States**:
  - Buttons: Default (amber bg), Hover (amber-600 with shadow), Active (scale 0.98), Disabled (zinc-700 with reduced opacity)
  - Inputs: Default (zinc-800 border), Focus (amber ring with 2px outline), Error (red-500 border), Filled (zinc-700 bg)
  - Cards: Default (zinc-900 bg), Hover (zinc-850 with subtle lift), Selected (amber border accent)

- **Icon Selection**:
  - Login: `Key`, `User`
  - Approvals: `CheckCircle`, `PencilSimple`, `ChatCircle`
  - Calendar: `Calendar`, `Clock`
  - Performance: `ChartBar`, `TrendUp`, `Eye`, `Heart`
  - Requests: `Plus`, `Article`, `CheckSquare`
  - Navigation: `List`, `X`, `Globe` (language)
  - Platform: Custom SVG icons for social platforms

- **Spacing**:
  - Page padding: `p-6` (24px) on mobile, `p-8` (32px) on desktop
  - Card padding: `p-6` (24px)
  - Card gaps: `gap-4` (16px) in grids
  - Section spacing: `space-y-6` (24px) between major sections
  - Form field spacing: `space-y-4` (16px)
  - Button padding: `px-6 py-3` (24px/12px)

- **Mobile**:
  - Single column card grid on mobile (<768px), 2-3 columns on desktop
  - Tabs switch to dropdown select on small screens
  - Collapsible metric cards that stack vertically
  - Fixed header with hamburger menu for tab navigation
  - Touch-optimized button sizes (min 44px height)
  - Reduced padding (p-4 instead of p-6/p-8)
