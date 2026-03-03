# 🌾 AgriGear ERP

**Enterprise Resource Planning for Agricultural Machinery Rental & Fleet Management**

AgriGear ERP is a full-stack, multi-tenant platform built to manage the end-to-end lifecycle of agricultural machinery rental operations — from farmer bookings and operator dispatching to mechanic maintenance, invoicing, payroll, and business intelligence reporting.

---

## ✨ Key Features

### 🏢 Multi-Tenant Architecture
- **Super Admin** provisions tenant organizations with isolated data
- **Owner** manages their company, creates managers, and monitors business health
- **Org Admin (Manager)** handles day-to-day fleet and staff operations
- **Operator** logs field work, tracks assignments, and records fuel usage
- **Farmer** browses machinery, creates bookings, and views invoices
- **Mechanic** accepts maintenance jobs, requests spare parts, and completes repairs

### 🚜 Fleet & Machinery Management
- Register and manage machinery with rate-per-hour / rate-per-acre pricing
- Real-time status tracking (Available, Booked, Under Maintenance)
- Machinery utilization analytics and ROI reporting per machine
- Fuel/diesel expense logging per machine

### 📋 Booking & Field Operations
- Farmers browse available machinery in a marketplace-style catalog
- Admin assigns operators and approves bookings
- Operators submit field logs with actual hours/acres worked
- Auto-invoicing and auto-wage generation on job completion
- Booking reassignment when machinery goes under maintenance

### 🔧 Maintenance & Spare Parts
- Create maintenance requests and assign mechanics
- Mechanics accept/reject jobs, request spare parts, log labor costs
- Manager approves spare parts with cost tracking
- Star rating system for mechanic reviews (1–5 stars)
- Full spare parts lifecycle: requested → approved → provided

### 💰 Invoicing & Payments
- Auto-generated invoices linked to completed bookings
- Payment tracking (Pending → Paid)
- Farmer-facing invoice portal

### 💵 Wages & Payroll
- Operator wages auto-calculated from field log hours × wage rate
- Mechanic wages generated on maintenance job completion
- Monthly payroll engine for salaried managers
- Pay individual operator/mechanic wages with audit trail

### 📊 Reports & Analytics
- **KPI Dashboard**: Revenue, bookings, active machinery, pending payments, company rating
- **Detail Reports**: Revenue, diesel, wages, maintenance, spare parts, farmer bookings, farmer directory, employee roster
- **Custom BI Reports**: Date-filtered financial summaries and fleet utilization
- **ROI Analysis**: Per-machine profitability (revenue − maintenance − diesel − wages)
- **CSV Export**: Export any report to CSV with totals and statistics

### 🔐 Authentication & Security
- JWT-based authentication with role-based access control
- Forced password change on first login
- Password reset via email (SMTP integration)
- User suspension with appeal ticketing system
- Farmer and mechanic self-registration with admin approval workflow

### 💬 Support & Communication
- Guest inquiry form for prospective users
- Suspended user appeal chat system
- Admin ticket management with email replies

---

## 🏗️ Tech Stack

| Layer       | Technology                                                |
|-------------|-----------------------------------------------------------|
| **Backend** | Python 3.10+, FastAPI, Pydantic v2, Motor (async MongoDB) |
| **Frontend**| React 19, Tailwind CSS 3, Radix UI, Recharts, Leaflet     |
| **Database**| MongoDB (local or Atlas)                                   |
| **Auth**    | JWT (python-jose), bcrypt (passlib)                        |
| **Email**   | SMTP (Gmail App Passwords)                                 |
| **Icons**   | Lucide React                                               |
| **Fonts**   | Manrope (headings), Public Sans (body), JetBrains Mono (data) |

---

## 📁 Project Structure

```
erp-emergent/
├── backend/
│   ├── server.py           # FastAPI application (all routes & models)
│   ├── requirements.txt    # Python dependencies
│   ├── run.bat             # Windows startup script
│   ├── .env                # Environment variables
│   └── utils/              # Utility modules
│
├── frontend/
│   ├── src/
│   │   ├── App.js          # React router with role-based redirects
│   │   ├── pages/          # 23 page components
│   │   ├── components/     # Layout, ProtectedRoute, UI primitives
│   │   ├── context/        # AuthContext (JWT + user state)
│   │   ├── api/            # Axios instance with interceptors
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utility functions
│   ├── package.json
│   └── tailwind.config.js
│
├── design_guidelines.json  # UI/UX design system reference
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+** — [Download](https://www.python.org/downloads/)
- **Node.js 18+** and **Yarn** — [Download Node](https://nodejs.org/) / `npm install -g yarn`
- **MongoDB** — [Download](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/erp-emergent.git
cd erp-emergent
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Configure Environment Variables

Create or edit `backend/.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=agrigear_erp
CORS_ORIGINS=*
SECRET_KEY=your-secret-key-change-in-production

# SMTP Email (Gmail App Password)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_NAME=AgriGear ERP
SMTP_EMAIL=your-email@gmail.com

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:3000
```

#### Start the Backend

```bash
# Option 1: Using the batch script (Windows)
run.bat

# Option 2: Manual
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at **http://localhost:8000**. Interactive docs at **http://localhost:8000/docs**.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
yarn install

# Start the development server
yarn start
```

The app will open at **http://localhost:3000**.

---

## 👤 User Roles & Access

| Role           | Access Level                                                    |
|----------------|-----------------------------------------------------------------|
| `super_admin`  | Manages all tenants, creates organizations, handles support     |
| `owner`        | Company owner — creates managers, views all org data            |
| `org_admin`    | Day-to-day operations — machinery, bookings, invoices, reports  |
| `operator`     | Field work — assigned bookings, field logs, fuel logging        |
| `farmer`       | Marketplace — browse machinery, create bookings, view invoices  |
| `mechanic`     | Maintenance — accept jobs, request parts, complete repairs      |

---

## 📡 API Overview

All routes are prefixed with `/api`. Key endpoint groups:

| Group                | Endpoints                          | Description                           |
|----------------------|------------------------------------|---------------------------------------|
| **Auth**             | `/login`, `/register`, `/forgot-password`, `/reset-password` | JWT authentication & password flows |
| **Users**            | `/admin/users`, `/employees`, `/operators` | User & staff management         |
| **Machinery**        | `/machinery`                       | Fleet CRUD & status management        |
| **Bookings**         | `/bookings`, `/bookings/{id}/rate` | Booking lifecycle & ratings           |
| **Field Logs**       | `/field-logs`                      | Operator work logging                 |
| **Invoices**         | `/invoices`, `/invoices/{id}/pay`  | Billing & payment                     |
| **Maintenance**      | `/maintenance`, `/maintenance/{id}/complete`, `/maintenance/{id}/review` | Repair lifecycle |
| **Wages**            | `/wages`, `/org/pay-operator/{id}`, `/org/pay-mechanic/{id}` | Payroll             |
| **Reports**          | `/reports/*`, `/dashboard/reports/{type}` | Analytics & BI                 |
| **Dashboard**        | `/dashboard`                       | KPI summary stats                     |
| **Organizations**    | `/admin/organizations`             | Multi-tenant management               |
| **Support**          | `/support/*`, `/admin/tickets/*`   | Ticketing & appeals                   |

---

## 🎨 Design System

The UI follows the **"Industrial Clean"** design language defined in `design_guidelines.json`:

- **Primary Color**: Deep Evergreen `#0F3D3E` — trust, reliability, agriculture
- **Accent Color**: Safety Orange `#F97316` — alerts, CTAs, critical status
- **Typography**: Manrope (headings), Public Sans (body), JetBrains Mono (data/IDs)
- **Layout**: Bento Grid dashboard, persistent sidebar navigation
- **Components**: Radix UI primitives, Sonner toast notifications, Recharts visualization

---

## 📦 MongoDB Collections

| Collection           | Purpose                                      |
|----------------------|----------------------------------------------|
| `users`              | All user accounts (all roles)                |
| `organizations`      | Tenant companies                             |
| `machinery`          | Registered machines with rates & status      |
| `employees`          | Staff records (operators, managers)           |
| `bookings`           | Farmer booking requests & assignments        |
| `field_logs`         | Operator work completion logs                |
| `invoices`           | Auto-generated billing records               |
| `payments`           | Payment transaction records                  |
| `maintenance`        | Maintenance/repair job lifecycle              |
| `material_requests`  | Spare part requests from mechanics           |
| `wages`              | Operator & mechanic wage records             |
| `fuel_expenses`      | Diesel/fuel cost tracking per machine        |
| `support_tickets`    | User appeal & inquiry threads                |

---

## 🧪 Development

```bash
# Backend — auto-reload on file changes
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Frontend — hot module replacement
yarn start

# Frontend production build
yarn build
```

---

## 📄 License

This project is proprietary. All rights reserved.
