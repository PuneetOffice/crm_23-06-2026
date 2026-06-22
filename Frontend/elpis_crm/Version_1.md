# ELPIS CRM - Complete Application Flow Report

**Date:** January 13, 2026  
**Application Type:** React + ASP.NET Core Web API  
**Purpose:** Customer Relationship Management (CRM) system with multi-table data management  

---

## 📋 Table of Contents
1. [Application Architecture Overview](#application-architecture-overview)
2. [Application Initialization Flow](#application-initialization-flow)
3. [Authentication & Authorization](#authentication--authorization)
4. [Core Application Flow](#core-application-flow)
5. [Component Architecture](#component-architecture)
6. [Data Flow & State Management](#data-flow--state-management)
7. [API Communication](#api-communication)
8. [Key Features](#key-features)
9. [Complete Flowchart](#complete-flowchart)

---

## Application Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ELPIS CRM APPLICATION                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Frontend   │◄────────┤   Backend    │                  │
│  │   (React)    │         │  (ASP.NET)   │                  │
│  │              │         │              │                  │
│  │ - UI Layer   │         │ - API Layer  │                  │
│  │ - Auth       │         │ - DB Layer   │                  │
│  │ - State Mgmt │         │ - Validation │                  │
│  └──────────────┘         └──────────────┘                  │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Microsoft Azure (MSAL Integration)          │   │
│  │  - OAuth 2.0 for Outlook/Email Authentication       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18+ | UI rendering, state management |
| **Styling** | Tailwind CSS | Responsive design |
| **Icons** | Lucide React, react-icons | UI icons |
| **Charts** | Recharts | Data visualization |
| **Notifications** | Sonner | Toast notifications |
| **Auth** | MSAL (Microsoft) | Azure AD authentication |
| **HTTP** | Axios | API requests |
| **Routing** | React Router v6 | Client-side navigation |
| **Backend** | ASP.NET Core | REST API |
| **Database** | SQL Server | Data persistence |
| **File Import** | ClosedXML, CsvHelper | Excel/CSV parsing |

---

## Application Initialization Flow

### **Step 1: Application Bootstrap**

```
File: src/index.js
        │
        ├─ Create MSAL Instance
        │  └─ Load msalConfig (Azure AD config)
        │     - Client ID: 09c6e32**************
        │     - Authority: Azure AD login
        │     - Cache: sessionStorage
        │
        ├─ Wrap App with MsalProvider
        │  └─ Enables OAuth 2.0 for Outlook/Email
        │
        ├─ Wrap App with BrowserRouter
        │  └─ Enables React Router navigation
        │
        └─ Render to DOM (root element)
```

### **Step 2: React App Initialization**

```
File: src/App.js
        │
        ├─ Wrap all Routes with AuthProvider
        │  └─ Provides JWT token & role management
        │
        ├─ Define Public Routes
        │  ├─ "/" → Login component
        │  └─ "/forgot" → Forgot Password component
        │
        ├─ Define Protected Routes (ProtectedRoute wrapper)
        │  ├─ "/Dashboard" → Main dashboard
        │  ├─ "/admin" → Admin-only dashboard
        │  ├─ "/manager" → Manager-only dashboard
        │  └─ "/user" → User-only dashboard
        │
        └─ Dashboard Nested Routes
           ├─ "/Dashboard/Accounts" → Accounts management
           ├─ "/Dashboard/Contacts" → Contacts management
           ├─ "/Dashboard/Products" → Products management
           ├─ "/Dashboard/Deals" → Deals/Pipelines
           ├─ "/Dashboard/OutlookEmail" → Outlook integration
           └─ "/Dashboard/users" → User management
```

---

## Authentication & Authorization

### **1. Login Flow**

```
User Action: Enter email/password and click Login
        │
        ▼
┌─────────────────────────────────────────┐
│  src/pages/Login.js                     │
├─────────────────────────────────────────┤
│                                           │
│  ✓ Validate email/password input        │
│  ✓ Show errors if invalid               │
│                                           │
│  POST /api/Login/check                  │
│  ├─ emailOrPhone: "user@example.com"   │
│  └─ password: "encrypted_password"      │
│                                           │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  ASP.NET Backend                        │
│  POST /Login/check endpoint             │
├─────────────────────────────────────────┤
│                                           │
│  ✓ Query database for user              │
│  ✓ Verify password (hash)               │
│  ✓ Generate JWT token                   │
│  ✓ Extract user role (admin/manager)    │
│                                           │
│  Response: {                            │
│    token: "jwt_token_here",             │
│    user: { email, name },               │
│    role: "admin|manager|user"           │
│  }                                       │
│                                           │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  AuthContext (src/auth/AuthContext.js)  │
├─────────────────────────────────────────┤
│                                           │
│  ✓ Decode JWT token                     │
│  ✓ Store token in localStorage          │
│  ✓ Extract role from token              │
│  ✓ Store user email/name in storage     │
│  ✓ Set isAuthenticated = true           │
│                                           │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│  Navigate to Dashboard                  │
├─────────────────────────────────────────┤
│                                           │
│  Role-based routing:                    │
│  ├─ role === "admin"   → /admin        │
│  ├─ role === "manager" → /manager      │
│  └─ role === "user"    → /user         │
│                                           │
└─────────────────────────────────────────┘
```

### **2. Token Management**

**File:** `src/auth/tokenUtils.js`

```javascript
// Operations:
setToken(token)      // Store in localStorage
getToken()           // Retrieve from localStorage
removeToken()        // Clear token on logout
decodeToken(token)   // Decode JWT (no verification)
isTokenExpired(token) // Check expiration (exp claim)
```

**JWT Structure (Decoded):**
```json
{
  "role": "admin|manager|user",
  "sub": "user_id",
  "email": "user@example.com",
  "exp": 1705084800,      // Expiration timestamp
  "iat": 1705081200       // Issued at timestamp
}
```

### **3. Protected Routes**

**File:** `src/ProtectedRoute.js`

```javascript
<ProtectedRoute allowedRoles={["admin"]}>
  <AdminDashboard />
</ProtectedRoute>

// Logic:
// 1. Check if authenticated (token exists + not expired)
// 2. If not authenticated → Redirect to "/"
// 3. If authenticated + allowedRoles specified:
//    - Extract role from token
//    - Check if role in allowedRoles
//    - If not → Redirect to "/unauthorized"
// 4. If authorized → Render children
```

### **4. Authorization Levels**

| Role | Access Level | Dashboard Route |
|------|-------------|-----------------|
| **Admin** | Full system access | `/admin` |
| **Manager** | Team data + reporting | `/manager` |
| **User** | Own data only | `/user` |
| **Unauthenticated** | Login page only | `/` |

---

## Core Application Flow

### **Main Dashboard Flow**

```
User lands on /Dashboard
        │
        ▼
┌────────────────────────────────────────┐
│  src/pages/Dashboard.js                │
│  (Main container component)            │
├────────────────────────────────────────┤
│                                          │
│  Initialize States:                    │
│  ├─ activeContent: "home"              │
│  ├─ openTabs: ["home"]                 │
│  ├─ Filters for all tables             │
│  ├─ Selected columns for display       │
│  └─ Import/add modals                  │
│                                          │
│  Initialize Hooks:                     │
│  ├─ useTaskReminders()  → Check tasks  │
│  ├─ useContext(AuthContext) → User role│
│  └─ useEffect() → Load column config   │
│                                          │
└────────────────────────────────────────┘
        │
        ├─ Render Header
        │  (Logo, user menu, notifications)
        │
        ├─ Render Sidebar
        │  │
        │  ├─ Home (default view)
        │  ├─ Accounts
        │  ├─ Contacts
        │  ├─ Products
        │  ├─ Deals
        │  ├─ Outlook Email
        │  └─ Users (admin only)
        │
        └─ Render Main Content Area
           │
           ├─ If activeContent === "home"
           │  └─ Render Home (Dashboard analytics)
           │
           ├─ If activeContent === "accounts"
           │  └─ Render Accounts component
           │     ├─ Load accounts data from API
           │     ├─ Apply filters
           │     ├─ Show/hide columns
           │     └─ Display table
           │
           ├─ If activeContent === "contacts"
           │  └─ Render Contacts component
           │
           ├─ If activeContent === "products"
           │  └─ Render Product component
           │
           └─ If activeContent === "deals"
              └─ Render Deals component
```

### **Navigation Flow**

```
User clicks on "Accounts" in Sidebar
        │
        ▼
Sidebar calls: openOrActivateTab("accounts")
        │
        ▼
Dashboard updates: setActiveContent("accounts")
        │
        ▼
useEffect monitors activeContent change
        │
        ▼
Fetch data: GET /api/Account/GetAccounts
        │
        ▼
Backend returns: [account1, account2, ...]
        │
        ▼
Update state: setAccounts([...])
        │
        ▼
Render: <Accounts data={accounts} />
```

---

## Component Architecture

### **Component Hierarchy**

```
App (Root)
└── AuthProvider (Provides token, role, login/logout)
    └── BrowserRouter (Handles client-side routing)
        └── Routes
            ├── Route: "/" → <Login />
            ├── Route: "/forgot" → <Forgot />
            └── ProtectedRoute: "/Dashboard"
                └── <Dashboard />
                    ├── <Header />
                    ├── <Sidebar />
                    └── Main Content
                        ├── <Home /> (Dashboard, charts, analytics)
                        ├── <Accounts />
                        ├── <Contacts />
                        ├── <Product />
                        ├── <Deals />
                        ├── <OutlookEmail />
                        ├── <Users />
                        ├── <AddForms /> (Modal)
                        ├── <FilterPanel /> (Modal)
                        ├── <ExcelImports /> (Modal)
                        └── <Email /> (Modal)
```

### **Key Components Breakdown**

#### **1. Login Component** (`src/pages/Login.js`)
- **Purpose:** Authenticate user with email/password
- **State:**
  - `EmailOrPhone`: Email or phone input
  - `password`: Password input
  - `errors`: Validation errors
  - `loading`: Spinner during request
- **Logic:**
  - Validate inputs
  - POST to `/api/Login/check`
  - Store token in AuthContext
  - Navigate based on role
- **Output:** JWT token stored, user authenticated

#### **2. Dashboard Component** (`src/pages/Dashboard.js`)
- **Purpose:** Main container for all data management
- **State:**
  - `activeContent`: Currently selected tab
  - `openTabs`: Array of open tabs
  - Filters for each table
  - Selected columns to display
  - Import/add modal states
- **Responsibilities:**
  - Manage global UI state
  - Handle data fetching
  - Coordinate between components
  - Manage modals and panels

#### **3. Accounts Component** (`src/pages/Accounts.js`)
- **Purpose:** Display and manage accounts
- **Props:**
  - `accounts`: Array of account objects
  - `filters`: Applied filters
  - `selectedColumns`: Columns to display
- **Features:**
  - Inline editing
  - Row expansion (slide-in detail view)
  - Delete with confirmation
  - Responsive table
- **Data Fields:** Name, Industry, Business Type, Country, State, City, Website, Phone, SalesOwner, Tags, etc.

#### **4. Contacts Component** (`src/pages/Contacts.js`)
- **Purpose:** Display and manage contacts
- **Props:** Same as Accounts
- **Features:** Similar to Accounts but for Contacts
- **Relationships:** Linked to Accounts via AccountId

#### **5. Home Component** (`src/pages/Home.js`)
- **Purpose:** Dashboard analytics and forecasting
- **Displays:**
  - Deal pipeline visualization
  - Forecast charts (monthly/quarterly/yearly)
  - Sales trends
  - Performance metrics
- **Data Source:** Deals table aggregation

#### **6. Sidebar Component** (`src/pages/Sidebar.js`)
- **Purpose:** Navigation menu
- **Features:**
  - Expandable/collapsible
  - Icons for each section
  - Active state highlighting
  - MSAL integration for logout

#### **7. AddForms Component** (`src/pages/add.js`)
- **Purpose:** Form to create new records
- **Supports:**
  - Add Accounts
  - Add Contacts (with Account linking)
  - Add Products
  - Add Deals (with multiple products)
- **Logic:**
  - Client-side validation
  - POST to API endpoint
  - Handle response/errors
  - Refresh parent component

#### **8. FilterPanel Component** (`src/pages/FilterPanel.js`)
- **Purpose:** Advanced filtering interface
- **Features:**
  - Multiple filter conditions
  - Exclude ID fields
  - Exclude "Deselect All" option
  - Apply/reset filters
- **State:** Filter rules by table type

#### **9. ExcelImports Component** (`src/pages/ExcelImports.js`)
- **Purpose:** Bulk import data from Excel/CSV
- **Features:**
  - 4-table selection (Accounts, Contacts, Products, Deals)
  - File validation (type, size: 1KB-50MB)
  - Drag-and-drop upload
  - File preview with truncation
  - Batch processing (1000 rows per batch)
- **Endpoint:** POST `/api/import/{tableName}`

#### **10. OutlookEmail Component** (`src/pages/OutlookEmail.js`)
- **Purpose:** Outlook email integration via MSAL
- **Features:**
  - OAuth 2.0 authentication
  - Scopes: User.Read, Mail.Read, Mail.ReadWrite, Mail.Send
  - Redirect: `/Dashboard/OutlookEmail`

---

## Data Flow & State Management

### **State Management Pattern**

The application uses **Lifted State** pattern where:
- Dashboard component holds most application state
- Child components receive data as props
- Child components communicate via callbacks

```
Dashboard (State Container)
  │
  ├─ accounts, setAccounts
  ├─ contacts, setContacts
  ├─ products, setProducts
  ├─ deals, setDeals
  ├─ activeContent, setActiveContent
  ├─ filters, setFilters
  └─ selectedColumns, setSelectedColumns
       │
       ├─ Passed to: <Accounts {...} />
       │  └─ Callback: onToast, onRefetch
       │
       ├─ Passed to: <Contacts {...} />
       │  └─ Callback: onToast, onRefetch
       │
       └─ Passed to: <FilterPanel {...} />
          └─ Callback: onApplyFilters
```

### **Data Fetching Flow**

```
Dashboard Component Mounts
        │
        ▼
useEffect hook triggers
        │
        ▼
Fetch multiple endpoints in parallel:
  ├─ GET /api/Account/GetAccounts
  ├─ GET /api/Contact/GetContacts
  ├─ GET /api/Product/GetProducts
  └─ GET /api/Deal/GetDeals
        │
        ▼
Wait for all promises with Promise.all()
        │
        ▼
Update state: setAccounts, setContacts, etc.
        │
        ▼
Components re-render with new data
```

### **Filtering Flow**

```
User applies filter in FilterPanel
        │
        ▼
FilterPanel calls: onApplyFilters(newFilters)
        │
        ▼
Dashboard updates: setContactFilters(newFilters)
        │
        ▼
Contacts component receives updated filters
        │
        ▼
useMemo applies filters:
   applyFilters(contacts, filters)
        │
        ▼
Returns filtered array
        │
        ▼
Table re-renders with filtered rows
```

**Filter Logic:** (`src/utils/filterUtils.js`)
```javascript
applyFilters(data, filters) → filtered_data
// Rules:
// - AND logic between filters (all must match)
// - Exact match for string/number fields
// - Partial match for text fields
// - Exclude ID fields (AccountId, ContactId, etc.)
// - Exclude "Deselect All" option
```

### **Add/Edit Flow**

```
User clicks "Add Account" → Opens AddForms modal
        │
        ▼
User fills form fields
        │
        ▼
User clicks "Submit"
        │
        ▼
Validate inputs locally
        │
        ├─ Valid?
        │  YES ▼
        │  POST /api/Account
        │  ├─ Success: Show toast, refresh data
        │  └─ Error: Show error toast
        │
        └─ Invalid?
           NO ▼
           Show validation errors in form
```

---

## API Communication

### **HTTP Client Setup**

**File:** `src/api/client.js`

```javascript
const client = axios.create({
  baseURL: `http://localhost:7229/api`,
  withCredentials: true,
  timeout: 30000  // 30 second timeout
});

// Request Interceptor:
// - Attach JWT token to every request header
// - Log requests (debug mode)

// Response Interceptor:
// - Handle 401 → Redirect to login
// - Handle 403 → Log warning (permission denied)
// - Normalize error responses
```

### **API Endpoints**

#### **Authentication**
| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/Login/check` | Login with email/password | No |
| POST | `/Forgot/check` | Password recovery | No |

#### **Accounts**
| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/Account/GetAccounts` | Fetch all accounts | Yes |
| POST | `/Account` | Create new account | Yes |
| PUT | `/Account/{id}` | Update account | Yes |
| DELETE | `/Account/{id}` | Delete account | Yes |

#### **Contacts**
| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/Contact/GetContacts` | Fetch all contacts | Yes |
| POST | `/Contact` | Create new contact | Yes |
| PUT | `/Contact/{id}` | Update contact | Yes |
| DELETE | `/Contact/{id}` | Delete contact | Yes |

#### **Products**
| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/Product/GetProducts` | Fetch all products | Yes |
| POST | `/Product` | Create new product | Yes |
| PUT | `/Product/{id}` | Update product | Yes |
| DELETE | `/Product/{id}` | Delete product | Yes |

#### **Deals**
| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/Deal/GetDeals` | Fetch all deals | Yes |
| GET | `/Deal/GetDealsForMonth/{year}/{month}` | Forecast data | Yes |
| POST | `/Deal` | Create new deal | Yes |
| PUT | `/Deal/{id}` | Update deal | Yes |
| DELETE | `/Deal/{id}` | Delete deal | Yes |

#### **Import/Export**
| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/import/accounts` | Bulk import accounts | Yes |
| POST | `/import/contacts` | Bulk import contacts | Yes |
| POST | `/import/products` | Bulk import products | Yes |
| POST | `/import/deals` | Bulk import deals | Yes |
| GET | `/import/status` | Check import service | Yes |

### **Request/Response Examples**

**Create Account:**
```javascript
POST /api/Account
Headers: {
  Authorization: "Bearer {jwt_token}",
  Content-Type: "application/json"
}
Body: {
  name: "Acme Corp",
  industryType: "Technology",
  businessType: "B2B",
  country: "USA",
  state: "California",
  website: "https://acme.com",
  phone: "+1-555-0123",
  salesOwner: "john.doe@example.com",
  createdBy: "admin"
}

Response: 201 Created
{
  accountId: 123,
  name: "Acme Corp",
  createdAt: "2026-01-13T10:30:00Z"
}
```

**Get Accounts:**
```javascript
GET /api/Account/GetAccounts
Headers: {
  Authorization: "Bearer {jwt_token}"
}

Response: 200 OK
[
  {
    accountId: 1,
    name: "Acme Corp",
    country: "USA",
    industryType: "Technology",
    salesOwner: "john.doe@example.com",
    createdAt: "2026-01-13T10:30:00Z"
  },
  // ... more accounts
]
```

**Bulk Import:**
```javascript
POST /api/import/accounts
Headers: {
  Authorization: "Bearer {jwt_token}"
}
Body: FormData {
  file: [Excel/CSV file]
}

Response: 200 OK
{
  success: true,
  message: "Successfully imported 100 rows",
  table: "Accounts",
  rowsInserted: 100,
  rowsSkipped: 0,
  errors: [],
  warnings: []
}
```

---

## Key Features

### **1. Multi-Table Data Management**
- **Accounts:** Company information, contact details, sales ownership
- **Contacts:** Individual contacts linked to accounts
- **Products:** Inventory with pricing and categories
- **Deals:** Sales pipeline with stages, forecasting

### **2. Advanced Filtering**
- Multiple filter conditions
- AND logic between filters
- Real-time filtering with useMemo optimization
- Exclude ID fields from filtering

### **3. Column Customization**
- Show/hide columns per table
- Remember selection in state
- Reorder columns via UI

### **4. Bulk Import**
- Support for Excel (.xlsx) and CSV files
- Drag-and-drop interface
- File validation (type, size: 1KB-50MB)
- Batch processing (1000 rows per batch)
- Transaction rollback on error
- Row-level error tracking

### **5. Dashboard Analytics**
- Deal pipeline visualization
- Sales forecasting (monthly/quarterly/yearly)
- Trend charts
- Performance metrics
- Export capability

### **6. Outlook Email Integration**
- OAuth 2.0 via Azure MSAL
- Read/send emails
- Track email interactions
- Attach to contacts/deals

### **7. Role-Based Access Control**
- Admin: Full system access
- Manager: Team data + reporting
- User: Own data only
- Unauthorized page for denied access

### **8. Task Reminders**
- Hook: `useTaskReminders()`
- Scheduled checks
- Toast notifications

### **9. Data Validation**
- Client-side: Required fields, formats
- Server-side: Business rules, constraints
- Error messages with guidance

### **10. Responsive UI**
- Mobile-friendly tables
- Collapsible sidebar
- Adaptive modals
- Toast notifications (Sonner)

---

## Complete Flowchart

### **Application Initialization to Login**

```
START
  │
  ├─ Load index.html (root div)
  │
  ├─ Initialize React App (index.js)
  │  ├─ Create MSAL instance (Azure AD)
  │  └─ Wrap App with:
  │     ├─ MsalProvider (OAuth support)
  │     ├─ BrowserRouter (React Router)
  │     └─ AuthProvider (JWT management)
  │
  ├─ Load App.js
  │  ├─ Define all routes
  │  └─ Check if user authenticated
  │
  ├─ User not authenticated?
  │  YES ▼ Navigate to "/"
  │  └─ Load Login.js
  │
  ├─ Login Page Displays
  │  ├─ Email/Phone field
  │  ├─ Password field
  │  ├─ Submit button
  │  └─ Forgot password link
  │
  ├─ User enters credentials & clicks Submit
  │  │
  │  ├─ Frontend Validation
  │  │  ├─ Email/Phone required?
  │  │  └─ Password required?
  │  │     NO ▼ Show errors, return
  │  │
  │  ├─ Send POST /api/Login/check
  │  │  ├─ Body: { emailOrPhone, password }
  │  │  └─ No auth header (public endpoint)
  │  │
  │  ├─ Backend processes (ASP.NET)
  │  │  ├─ Query database for user
  │  │  ├─ Verify password hash
  │  │  ├─ Generate JWT token
  │  │  └─ Return response
  │  │
  │  ├─ Check response
  │  │  ├─ Has token?
  │  │  │  YES ▼
  │  │  │  ├─ Call auth.login(token)
  │  │  │  ├─ Store token in localStorage
  │  │  │  ├─ Decode token, extract role
  │  │  │  ├─ Store user email/name
  │  │  │  └─ Set isAuthenticated = true
  │  │  │
  │  │  └─ No token?
  │  │     NO ▼ Show error message
  │  │
  │  ├─ Extract role from token
  │  │  ├─ role === "admin"   → navigate("/admin")
  │  │  ├─ role === "manager" → navigate("/manager")
  │  │  ├─ role === "user"    → navigate("/user")
  │  │  └─ No role?           → navigate("/Dashboard")
  │  │
  │  └─ React Router navigates to dashboard
  │
  └─ SUCCESS: User authenticated and in Dashboard
```

### **Dashboard Main Flow**

```
User enters Dashboard (/Dashboard)
  │
  ├─ ProtectedRoute checks:
  │  ├─ Token exists? (auth.isAuthenticated)
  │  └─ Role allowed? (matches allowedRoles)
  │     NO ▼ Redirect to /unauthorized
  │
  ├─ Dashboard.js mounts
  │  │
  │  ├─ Initialize state:
  │  │  ├─ activeContent = "home"
  │  │  ├─ openTabs = ["home"]
  │  │  ├─ showFilterPanel = null
  │  │  ├─ filters for each table
  │  │  └─ selectedColumns for each table
  │  │
  │  ├─ Initialize hooks:
  │  │  ├─ useTaskReminders() → Check reminders
  │  │  ├─ useContext(AuthContext) → Get user role
  │  │  └─ useEffect → Load all data
  │  │
  │  └─ useEffect triggers data load:
  │     ├─ GET /api/Account/GetAccounts
  │     ├─ GET /api/Contact/GetContacts
  │     ├─ GET /api/Product/GetProducts
  │     └─ GET /api/Deal/GetDeals
  │        │
  │        └─ Wait for all (Promise.all)
  │           └─ setAccounts, setContacts, etc.
  │
  ├─ Render Dashboard Layout:
  │  │
  │  ├─ Header
  │  │  ├─ Logo
  │  │  ├─ User menu (email, avatar)
  │  │  └─ Notifications
  │  │
  │  ├─ Sidebar (collapsible)
  │  │  ├─ Home (FiHome)
  │  │  ├─ Accounts (FiBriefcase)
  │  │  ├─ Contacts (FiUsers)
  │  │  ├─ Products (FiBox)
  │  │  ├─ Deals (FiDollarSign)
  │  │  ├─ Email (FiMail)
  │  │  └─ Users (admin only)
  │  │
  │  └─ Main Content Area
  │     ├─ If activeContent = "home"
  │     │  └─ Home component
  │     │     ├─ Pipeline visualization
  │     │     ├─ Forecast charts
  │     │     ├─ Trend analysis
  │     │     └─ Import button → ExcelImports modal
  │     │
  │     ├─ If activeContent = "accounts"
  │     │  └─ Accounts component
  │     │     ├─ Table with all accounts
  │     │     ├─ Filter button → FilterPanel modal
  │     │     ├─ Add button → AddForms modal
  │     │     └─ Actions: Edit, Delete, Expand
  │     │
  │     ├─ If activeContent = "contacts"
  │     │  └─ Contacts component
  │     │
  │     └─ ... other components
  │
  └─ User interaction loop (see below)
```

### **User Interaction - Viewing Data**

```
User clicks "Accounts" in Sidebar
  │
  ├─ Sidebar calls: openOrActivateTab("accounts")
  │
  ├─ Dashboard updates: setActiveContent("accounts")
  │
  ├─ Dashboard re-renders with activeContent = "accounts"
  │
  ├─ Accounts component receives props:
  │  ├─ accounts: [account objects]
  │  ├─ filters: [applied filters]
  │  ├─ selectedColumns: [columns to show]
  │  └─ onToast, onRefetch callbacks
  │
  ├─ Accounts component uses useMemo:
  │  ├─ Apply filters: applyFilters(accounts, filters)
  │  └─ Result: filteredAccounts
  │
  ├─ Component renders table:
  │  ├─ Header row with column names
  │  └─ Body rows for each filtered account
  │     ├─ Show only selectedColumns
  │     ├─ Highlight matching text (search)
  │     └─ Allow hover actions (Edit, Delete, Expand)
  │
  └─ Table displayed to user
```

### **User Interaction - Filtering**

```
User clicks "Filter" button
  │
  ├─ Dashboard shows: FilterPanel modal
  │
  ├─ User adds filter conditions
  │  ├─ Select field (exclude ID fields)
  │  ├─ Choose operator (=, contains, etc.)
  │  └─ Enter value
  │
  ├─ User clicks "Apply Filters"
  │
  ├─ FilterPanel calls: onApplyFilters(newFilters)
  │
  ├─ Dashboard updates state:
  │  └─ setContactFilters(newFilters)
  │
  ├─ Contacts component re-renders
  │  ├─ useEffect detects filters changed
  │  └─ useMemo applies new filters
  │
  ├─ Component re-renders table
  │  └─ Only rows matching ALL filters shown
  │
  └─ User sees filtered results
```

### **User Interaction - Adding Data**

```
User clicks "Add Account" button
  │
  ├─ Dashboard shows: AddForms modal (type="accounts")
  │
  ├─ AddForms renders form fields:
  │  ├─ Name (required)
  │  ├─ Industry Type
  │  ├─ Country (dropdown with State/City)
  │  ├─ Website, Phone
  │  ├─ SalesOwner (read-only, current user)
  │  ├─ CreatedBy (read-only, current user)
  │  └─ ... other fields
  │
  ├─ User fills form and clicks "Add Account"
  │
  ├─ Frontend validation:
  │  ├─ Name required?
  │  └─ Other required fields?
  │     NO ▼ Show validation errors, return
  │
  ├─ Build request body:
  │  ├─ Convert field names to camelCase
  │  ├─ Set CreatedBy = logged-in user
  │  └─ Set timestamps if needed
  │
  ├─ POST /api/Account
  │  ├─ Headers: { Authorization: Bearer token }
  │  └─ Body: { name, industryType, ... }
  │
  ├─ Backend creates record
  │  └─ Returns: { accountId, name, ... }
  │
  ├─ Check response
  │  ├─ Success?
  │  │  YES ▼
  │  │  ├─ Show toast: "Account added"
  │  │  ├─ Call onRefetch()
  │  │  ├─ Dashboard refetches accounts
  │  │  └─ Modal closes
  │  │
  │  └─ Error?
  │     YES ▼
  │     └─ Show error toast
  │
  └─ User sees updated table
```

### **User Interaction - Deleting Data**

```
User clicks Delete icon on a row
  │
  ├─ Component shows confirmation dialog
  │  └─ "Are you sure?"
  │
  ├─ User clicks "Confirm"
  │
  ├─ DELETE /api/Account/{accountId}
  │  └─ Headers: { Authorization: Bearer token }
  │
  ├─ Backend deletes record
  │  └─ Returns: { success: true } or error
  │
  ├─ Check response
  │  ├─ Success?
  │  │  YES ▼
  │  │  ├─ Show toast: "Deleted"
  │  │  ├─ Call onRefetch()
  │  │  └─ Table re-renders without row
  │  │
  │  └─ Error?
  │     YES ▼
  │     └─ Show error toast
  │
  └─ User sees row removed
```

### **User Interaction - Bulk Import**

```
User clicks "Import" button on dashboard
  │
  ├─ Dashboard shows: ExcelImports modal
  │
  ├─ ExcelImports Step 1: Select table type
  │  ├─ Show 2x2 grid:
  │  │  ├─ Accounts (FiBriefcase, blue)
  │  │  ├─ Contacts (FiUsers, grey)
  │  │  ├─ Products (FiBox, grey)
  │  │  └─ Deals (FiDollarSign, blue)
  │  │
  │  └─ User clicks one table
  │     └─ ExcelImports moves to Step 2
  │
  ├─ ExcelImports Step 2: Upload file
  │  ├─ Show drag-and-drop zone
  │  ├─ or click to select file
  │  │
  │  └─ User selects file
  │     ├─ Frontend validates:
  │     │  ├─ File type: .xlsx or .csv?
  │     │  ├─ File size: 1KB - 50MB?
  │     │  └─ File not empty?
  │     │     NO ▼ Show error, return
  │     │
  │     ├─ Display file preview:
  │     │  ├─ Truncated filename with tooltip
  │     │  └─ File size in KB
  │     │
  │     └─ Show "Upload" button
  │
  ├─ User clicks "Upload"
  │
  ├─ FormData created:
  │  └─ file: [File object]
  │
  ├─ POST /api/import/{tableName}
  │  ├─ Headers: { Authorization: Bearer token }
  │  ├─ Body: FormData with file
  │  └─ Show loading spinner
  │
  ├─ Backend processes (see import service):
  │  ├─ Parse Excel/CSV file
  │  ├─ Validate rows
  │  ├─ Build in batches (1000 rows)
  │  ├─ SqlBulkCopy insert
  │  ├─ Track errors per row
  │  ├─ Transaction rollback on error
  │  └─ Return ImportResult
  │
  ├─ Response received:
  │  {
  │    success: true,
  │    message: "100 rows imported",
  │    rowsInserted: 100,
  │    rowsSkipped: 0,
  │    errors: [],
  │    warnings: []
  │  }
  │
  ├─ Frontend processes response:
  │  ├─ Show success toast
  │  ├─ Display row counts
  │  ├─ If errors: show error details
  │  ├─ If warnings: show warning messages
  │  └─ Close modal
  │
  ├─ Dashboard refetches data
  │
  └─ User sees imported records in table
```

### **User Logout Flow**

```
User clicks user menu → "Logout"
  │
  ├─ Header/Sidebar calls: auth.logout()
  │
  ├─ AuthContext.logout():
  │  ├─ Call tokenUtils.removeToken()
  │  │  └─ localStorage.removeItem("authToken")
  │  │
  │  ├─ setToken(null)
  │  ├─ setRole(null)
  │  ├─ Clear sessionStorage
  │  │  ├─ userEmail
  │  │  └─ userName
  │  │
  │  └─ navigate("/")
  │
  ├─ Token removed from all requests
  │
  ├─ React Router navigates to "/"
  │
  ├─ ProtectedRoute checks isAuthenticated
  │  └─ FALSE ▼ Redirect to "/"
  │
  └─ User sees Login page
```

---

## Environment Configuration

### **.env File Variables**

```ini
# Frontend (React)
REACT_APP_API_HOST=localhost
REACT_APP_API_PORT=7229
REACT_APP_API_BASE=http://localhost:7229/api
REACT_APP_MSAL_REDIRECT_URI=http://localhost:3000/Dashboard/OutlookEmail

# Backend (ASP.NET)
# Database connection string
# JWT secret key
# CORS settings
```

---

## Error Handling

### **Frontend Error Handling**

```
API Request → Response
  │
  ├─ Status 200-299?
  │  YES ▼ Return response
  │
  ├─ Status 401 (Unauthorized)?
  │  YES ▼
  │  ├─ Clear token
  │  ├─ Redirect to "/"
  │  └─ User sees login page
  │
  ├─ Status 403 (Forbidden)?
  │  YES ▼
  │  ├─ Log warning
  │  └─ Show error toast
  │
  ├─ Status 400 (Bad Request)?
  │  YES ▼
  │  ├─ Extract error message
  │  └─ Show validation errors
  │
  ├─ Status 500 (Server Error)?
  │  YES ▼
  │  ├─ Log error
  │  └─ Show "Something went wrong" message
  │
  └─ Network error?
     YES ▼
     └─ Show "Connection failed" message
```

### **Backend Error Handling** (Import Service)

```
ImportAsync() called
  │
  ├─ ValidateRequest()
  │  ├─ File null? → Return error
  │  ├─ Table unknown? → Return error
  │  ├─ File > 50MB? → Return error
  │  └─ Invalid file type? → Return error
  │
  ├─ Parse file (Excel/CSV)
  │  ├─ Invalid format?
  │  │  YES ▼ Log error, skip row
  │  │
  │  └─ Valid → Extract columns
  │
  ├─ Process rows in batches (1000)
  │  ├─ For each row:
  │  │  ├─ Validate required fields
  │  │  ├─ Type conversion
  │  │  ├─ Foreign key lookup
  │  │  └─ Error? Log row number
  │  │
  │  └─ SqlBulkCopy insert batch
  │     ├─ Timeout? → Rollback
  │     └─ Constraint violation? → Log error
  │
  ├─ Build ImportResult:
  │  ├─ rowsInserted: count
  │  ├─ rowsSkipped: count
  │  ├─ errors: [list of row errors, max 50]
  │  └─ warnings: [non-critical messages]
  │
  └─ Return response
```

---

## Performance Optimizations

### **Frontend Optimizations**

1. **useMemo for filtering/sorting** - Prevent unnecessary recalculations
2. **useCallback for event handlers** - Prevent function recreation
3. **Lazy loading components** - Load only when needed
4. **Virtualization for large tables** - Render only visible rows
5. **Debounced search** - Limit API calls while typing

### **Backend Optimizations**

1. **Batch processing for imports** - 1000 rows per batch
2. **SqlBulkCopy for inserts** - Faster than individual inserts
3. **Connection pooling** - Reuse database connections
4. **Indexes on frequently queried fields** - AccountId, ContactId, etc.
5. **Pagination for API responses** - Return limited rows

---

## Security Measures

1. **JWT Token Authentication** - All API requests require valid token
2. **Role-Based Access Control** - Routes protected by role
3. **HTTPS in Production** - Encrypted communication
4. **CORS Configuration** - Only allowed origins
5. **Input Validation** - Client and server side
6. **SQL Injection Prevention** - Parameterized queries
7. **XSS Protection** - React auto-escapes values
8. **CSRF Protection** - SameSite cookie attribute

---

## Testing Recommendations

### **Unit Tests**
- Token encoding/decoding
- Filter logic
- Date formatting functions
- Validation functions

### **Integration Tests**
- Login flow
- Data fetching
- Filtering and display
- Adding/editing/deleting records

### **E2E Tests**
- Complete user journeys
- Import workflows
- Role-based access
- Error scenarios

---

## Deployment Checklist

- [ ] Set production environment variables
- [ ] Configure CORS for production domain
- [ ] Set up SSL/HTTPS certificates
- [ ] Configure database connection string
- [ ] Set JWT secret key
- [ ] Test all API endpoints
- [ ] Configure Azure AD credentials
- [ ] Set up error logging
- [ ] Configure backup strategy
- [ ] Performance testing with 50MB+ files
- [ ] Security audit
- [ ] Documentation complete

---

## Summary

**Elpis CRM** is a comprehensive customer relationship management system built with:
- **Frontend:** React + Tailwind CSS + Recharts for modern UI
- **Backend:** ASP.NET Core Web API for robust data management
- **Authentication:** JWT tokens + Azure MSAL for OAuth
- **Data Management:** Multi-table support (Accounts, Contacts, Products, Deals)
- **Advanced Features:** Filtering, bulk import, forecasting, email integration

The application follows modern React patterns with lifted state, hooks, and component composition. It implements proper authentication, authorization, and error handling. The data flow is unidirectional from parent (Dashboard) to child components, with callbacks for communication back up the component tree.

---

**Document Version:** 1.0  
**Last Updated:** January 13, 2026  
**Application Status:** ✅ Fully Functional
