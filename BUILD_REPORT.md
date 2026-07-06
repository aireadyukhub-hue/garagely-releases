# Garagely — Build Report

## Status: Complete ✓

All 10 core features implemented, seed data loaded, brand assets wired in.

---

## Run Commands

```bash
# Install dependencies (one-time)
npm install

# Rebuild better-sqlite3 for your Electron version (one-time)
./node_modules/.bin/electron-rebuild -f -w better-sqlite3

# Start dev server (Vite + Electron)
npm run dev

# Build for distribution
npm run build       # builds renderer + electron TypeScript

# Package installers
npm run dist:mac    # → release/Garagely-1.0.0.dmg  (run on macOS)
npm run dist:win    # → release/Garagely Setup 1.0.0.exe  (run on Windows or with wine)
npm run dist        # builds both
```

---

## What's Complete

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Dashboard | ✅ Complete | Today's bookings, active jobs, revenue stats, MOT/service alerts, activity feed |
| 2 | Customers | ✅ Complete | Full CRUD, list with search, detail view with vehicle/job history |
| 3 | Vehicles | ✅ Complete | Full CRUD, MOT/service due dates with overdue alerts, service timeline |
| 4 | Jobs / Work Orders | ✅ Complete | Full CRUD, line item editor (labour + parts), status workflow, technician notes |
| 5 | Invoicing | ✅ Complete | Generate from job, UK VAT (20%, configurable), paid/unpaid tracking, print-to-PDF |
| 6 | Quotes / Estimates | ✅ Complete | Full CRUD, convert to job, line items, status workflow |
| 7 | Calendar | ✅ Complete | Week view, click-to-add bookings, colour-coded, delete bookings |
| 8 | Parts / Inventory | ✅ Complete | Full CRUD, stock levels, low-stock alerts, cost/sale/margin display |
| 9 | Reports | ✅ Complete | Revenue chart (daily), jobs by status pie chart, jobs by technician, date range filters |
| 10 | Settings | ✅ Complete | Business details, labour rate, VAT rate, invoice/quote prefix and numbering |

---

## Seed Data Loaded

- **12 customers** across Birmingham, Solihull, Coventry, Wolverhampton
- **14 vehicles** (Ford, VW, BMW, Hyundai, Toyota, Mercedes, Nissan, Kia, Peugeot, etc.)
- **12 jobs** in various statuses (booked, in progress, awaiting parts, complete, invoiced)
- **6 invoices** (mix of paid and unpaid, totalling ~£1,480)
- **7 bookings** spanning this week and next
- **3 quotes** (draft, sent, accepted)
- **12 parts** with stock levels and low-stock scenarios

---

## Tech Stack

- **Electron 31** — desktop shell, macOS/Windows
- **React 18 + TypeScript** — UI
- **Vite 5** — bundler
- **Tailwind CSS** — styling (dark mode default, brand blue `#1F6FEB`)
- **SQLite via better-sqlite3** — local database, zero-config
- **React Router v6** — navigation
- **Recharts** — revenue and job charts
- **date-fns** — date handling
- **lucide-react** — icons

---

## Build Verification

All builds verified in CI:
```
✓ Electron TypeScript: dist-electron/main.js, preload.js, database.js, ipc.js
✓ Vite renderer: dist/index.html + dist/assets/ (JS, CSS, brand SVGs, PNGs)
✓ Database: 12 customers, 14 vehicles, 12 jobs, 6 invoices seeded and readable
✓ Node syntax check: all 4 compiled Electron files pass --check
```

---

## Packaging Notes

The `npm run dist` commands use **electron-builder** and require:
1. The Electron binary downloaded on the build machine (runs automatically on first `npm install` with network access)
2. **macOS**: `npm run dist:mac` — produces `.dmg`. Needs macOS for proper `.icns` generation. The `build/icon.icns` placeholder will be replaced automatically by electron-builder using `build/icon.png` if the `.icns` is not a valid ICNS file.
3. **Windows**: `npm run dist:win` — produces NSIS `.exe` installer. The `build/icon.ico` multi-size ICO file is included.

### Quick fix for icon on macOS build machine:
```bash
# Replace icon.icns with a properly-built one:
mkdir -p tmp.iconset
sips -z 512 512 assets/icon-512.png --out tmp.iconset/icon_512x512.png
# ... (add other sizes)
iconutil -c icns tmp.iconset -o build/icon.icns
```

---

## Partial / TODO

- **Invoice PDF export**: Print-to-PDF via browser `window.print()` is wired. A proper `jspdf` + `jspdf-autotable` server-side PDF export is scaffolded in the package.json deps but not implemented — marked TODO in `InvoiceDetail.tsx`. The print stylesheet produces a clean invoice view.
- **Drag-to-reschedule in Calendar**: Calendar is a week grid with click-to-add. Drag-and-drop reschedule is marked TODO.
- **Parts auto-deduct on job**: Parts linked via `part_id` in job line items — stock decrement on job completion is TODO.
- **Mileage tracking history**: Current model stores latest mileage only. Full mileage history table is TODO.
- **Multi-technician shifts**: Basic `assigned_to` text field. Full technician management is TODO.

---

## File Structure

```
GarageDash/
├── electron/           # Electron main process (TypeScript → CommonJS)
│   ├── main.ts         # App entry, window creation
│   ├── preload.ts      # contextBridge IPC API
│   ├── database.ts     # SQLite init + schema + seed data
│   └── ipc.ts          # All IPC handlers (CRUD for every entity)
├── src/                # React renderer (TypeScript + Vite)
│   ├── App.tsx         # Router
│   ├── main.tsx        # React entry
│   ├── index.css       # Tailwind + custom component classes
│   ├── lib/
│   │   ├── api.ts      # IPC bridge type + export
│   │   └── utils.ts    # formatCurrency, formatDate, status colours, etc.
│   ├── types/index.ts  # All TypeScript interfaces
│   ├── components/
│   │   ├── layout/Layout.tsx   # Collapsible sidebar, brand logos
│   │   └── ui/Modal.tsx        # Reusable modal component
│   └── pages/          # One file per route
│       ├── Dashboard.tsx
│       ├── Customers.tsx / CustomerDetail.tsx
│       ├── Vehicles.tsx / VehicleDetail.tsx
│       ├── Jobs.tsx / JobDetail.tsx
│       ├── Invoices.tsx / InvoiceDetail.tsx
│       ├── Quotes.tsx
│       ├── Calendar.tsx
│       ├── Parts.tsx
│       ├── Reports.tsx
│       └── Settings.tsx
├── public/assets/      # Brand assets (served by Vite dev server)
├── assets/             # Brand assets (copied to dist/assets/ at build time)
├── build/              # Electron builder icon files (icon.ico, icon.icns)
├── dist/               # Compiled renderer output
├── dist-electron/      # Compiled Electron main process output
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json / tsconfig.electron.json
└── package.json
```
