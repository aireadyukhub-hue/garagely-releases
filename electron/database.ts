import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

export function initDatabase(userDataPath: string): Database.Database {
  const dbPath = path.join(userDataPath, 'garagely.db')
  const db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createSchema(db)
  seedIfEmpty(db)

  return db
}

function createSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      business_name TEXT DEFAULT 'My Garage',
      address TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      vat_number TEXT DEFAULT '',
      vat_rate REAL DEFAULT 20,
      labour_rate REAL DEFAULT 65,
      invoice_prefix TEXT DEFAULT 'INV',
      invoice_next INTEGER DEFAULT 1001,
      quote_prefix TEXT DEFAULT 'QUO',
      quote_next INTEGER DEFAULT 1001,
      currency TEXT DEFAULT 'GBP',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      mobile TEXT,
      address TEXT,
      city TEXT,
      postcode TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      registration TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER,
      colour TEXT,
      vin TEXT,
      engine_size TEXT,
      fuel_type TEXT,
      mileage INTEGER,
      mot_due TEXT,
      service_due TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      status TEXT NOT NULL DEFAULT 'booked',
      title TEXT NOT NULL,
      description TEXT,
      technician_notes TEXT,
      assigned_to TEXT,
      estimated_hours REAL DEFAULT 0,
      labour_rate REAL DEFAULT 65,
      booked_date TEXT,
      started_date TEXT,
      completed_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'labour',
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      part_id INTEGER REFERENCES parts(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      job_id INTEGER REFERENCES jobs(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      status TEXT NOT NULL DEFAULT 'draft',
      subtotal REAL NOT NULL DEFAULT 0,
      vat_rate REAL DEFAULT 20,
      vat_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      due_date TEXT,
      paid_date TEXT,
      payment_method TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      vehicle_id INTEGER REFERENCES vehicles(id),
      status TEXT NOT NULL DEFAULT 'draft',
      title TEXT,
      subtotal REAL DEFAULT 0,
      vat_rate REAL DEFAULT 20,
      vat_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      notes TEXT,
      valid_until TEXT,
      converted_job_id INTEGER REFERENCES jobs(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quote_line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      vehicle_id INTEGER REFERENCES vehicles(id),
      job_id INTEGER REFERENCES jobs(id),
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'confirmed',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT,
      name TEXT NOT NULL,
      description TEXT,
      supplier TEXT,
      cost_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      stock_quantity INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 2,
      location TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

function seedIfEmpty(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM customers').get() as { c: number }).c
  if (count > 0) return

  // Insert default settings
  db.prepare(`INSERT OR IGNORE INTO settings (id, business_name, address, phone, email, vat_number, vat_rate, labour_rate)
    VALUES (1, 'Apex Auto Services', '14 Industrial Way, Birmingham', '0121 456 7890', 'info@apexauto.co.uk', 'GB123456789', 20, 65)`).run()

  // Seed customers
  const insertCustomer = db.prepare(`INSERT INTO customers (first_name, last_name, email, phone, mobile, address, city, postcode, notes)
    VALUES (@first_name, @last_name, @email, @phone, @mobile, @address, @city, @postcode, @notes)`)

  const customers = [
    { first_name: 'James', last_name: 'Harrison', email: 'james.h@email.com', phone: '0121 234 5678', mobile: '07700 900001', address: '12 Oak Street', city: 'Birmingham', postcode: 'B1 1AA', notes: 'Regular customer, prefers morning appointments' },
    { first_name: 'Sarah', last_name: 'Mitchell', email: 'sarah.m@gmail.com', phone: '', mobile: '07700 900002', address: '45 Maple Avenue', city: 'Solihull', postcode: 'B91 2BB', notes: 'Fleet account - 2 vehicles' },
    { first_name: 'David', last_name: 'Clarke', email: 'd.clarke@work.com', phone: '0121 876 5432', mobile: '07700 900003', address: '8 Elm Close', city: 'Birmingham', postcode: 'B15 3CC', notes: '' },
    { first_name: 'Emma', last_name: 'Thompson', email: 'emma.t@email.co.uk', phone: '', mobile: '07700 900004', address: '22 Pine Road', city: 'Coventry', postcode: 'CV1 4DD', notes: 'Referred by James Harrison' },
    { first_name: 'Robert', last_name: 'Wilson', email: 'rwilson@hotmail.com', phone: '024 7654 3210', mobile: '07700 900005', address: '7 Birch Lane', city: 'Coventry', postcode: 'CV2 5EE', notes: '' },
    { first_name: 'Lisa', last_name: 'Patel', email: 'l.patel@email.com', phone: '', mobile: '07700 900006', address: '33 Cedar Drive', city: 'Birmingham', postcode: 'B25 6FF', notes: 'Taxi driver - high mileage' },
    { first_name: 'Michael', last_name: 'Brown', email: 'mike.brown@company.com', phone: '0121 345 6789', mobile: '07700 900007', address: '5 Walnut Way', city: 'Solihull', postcode: 'B90 7GG', notes: '' },
    { first_name: 'Helen', last_name: 'Davies', email: 'h.davies@email.co.uk', phone: '', mobile: '07700 900008', address: '19 Ash Grove', city: 'Birmingham', postcode: 'B11 8HH', notes: 'Elderly - needs collection/drop off' },
    { first_name: 'Peter', last_name: 'Johnson', email: 'p.johnson@email.com', phone: '0121 567 8901', mobile: '07700 900009', address: '66 Beech Street', city: 'Birmingham', postcode: 'B5 9II', notes: '' },
    { first_name: 'Karen', last_name: 'Smith', email: 'ksmith@gmail.com', phone: '', mobile: '07700 900010', address: '3 Chestnut Close', city: 'Wolverhampton', postcode: 'WV1 0JJ', notes: 'Has extended warranty' },
    { first_name: 'Tom', last_name: 'O\'Brien', email: 'tobrien@email.com', phone: '01902 123456', mobile: '07700 900011', address: '11 Willow Park', city: 'Wolverhampton', postcode: 'WV2 1KK', notes: '' },
    { first_name: 'Anita', last_name: 'Sharma', email: 'anita.s@business.co.uk', phone: '0121 789 0123', mobile: '07700 900012', address: '44 Sycamore Avenue', city: 'Birmingham', postcode: 'B17 2LL', notes: 'Business account - 3 vans' },
  ]

  const customerIds: number[] = []
  for (const c of customers) {
    const result = insertCustomer.run(c)
    customerIds.push(result.lastInsertRowid as number)
  }

  // Seed vehicles
  const insertVehicle = db.prepare(`INSERT INTO vehicles (customer_id, registration, make, model, year, colour, vin, fuel_type, mileage, mot_due, service_due)
    VALUES (@customer_id, @registration, @make, @model, @year, @colour, @vin, @fuel_type, @mileage, @mot_due, @service_due)`)

  const vehicleData = [
    { customer_id: customerIds[0], registration: 'BD21 XYZ', make: 'Ford', model: 'Focus', year: 2021, colour: 'Silver', vin: 'WF0RXXGCDRLS12345', fuel_type: 'Petrol', mileage: 34200, mot_due: '2025-03-15', service_due: '2025-06-01' },
    { customer_id: customerIds[1], registration: 'SL19 ABC', make: 'Volkswagen', model: 'Golf', year: 2019, colour: 'Blue', vin: 'WVWZZZ1KZAM123456', fuel_type: 'Diesel', mileage: 67800, mot_due: '2024-11-22', service_due: '2024-12-01' },
    { customer_id: customerIds[1], registration: 'SL20 DEF', make: 'Vauxhall', model: 'Astra', year: 2020, colour: 'White', vin: 'W0L0AHF0813456789', fuel_type: 'Petrol', mileage: 45100, mot_due: '2025-08-10', service_due: '2025-09-15' },
    { customer_id: customerIds[2], registration: 'DC15 GHI', make: 'BMW', model: '3 Series', year: 2015, colour: 'Black', vin: 'WBA3A5C5XDF123456', fuel_type: 'Diesel', mileage: 98500, mot_due: '2024-09-05', service_due: '2024-10-01' },
    { customer_id: customerIds[3], registration: 'ET22 JKL', make: 'Hyundai', model: 'Tucson', year: 2022, colour: 'Red', vin: 'TMAJ381AANU123456', fuel_type: 'Hybrid', mileage: 18900, mot_due: '2025-05-20', service_due: '2025-06-30' },
    { customer_id: customerIds[4], registration: 'RW18 MNO', make: 'Toyota', model: 'Yaris', year: 2018, colour: 'Grey', vin: 'VNKKD3D3XJA123456', fuel_type: 'Petrol', mileage: 54300, mot_due: '2024-12-15', service_due: '2025-01-01' },
    { customer_id: customerIds[5], registration: 'LP16 PQR', make: 'Ford', model: 'Transit', year: 2016, colour: 'White', vin: 'WF0XXXTTGXFD12345', fuel_type: 'Diesel', mileage: 189000, mot_due: '2024-10-30', service_due: '2024-11-15' },
    { customer_id: customerIds[6], registration: 'MB23 STU', make: 'Mercedes', model: 'C-Class', year: 2023, colour: 'White', vin: 'WDD2050022R123456', fuel_type: 'Petrol', mileage: 8200, mot_due: '2026-04-01', service_due: '2026-03-01' },
    { customer_id: customerIds[7], registration: 'HD14 VWX', make: 'Nissan', model: 'Micra', year: 2014, colour: 'Purple', vin: 'VSKBAAC10U123456', fuel_type: 'Petrol', mileage: 72600, mot_due: '2024-11-01', service_due: '2025-02-01' },
    { customer_id: customerIds[8], registration: 'PJ20 YZA', make: 'Kia', model: 'Sportage', year: 2020, colour: 'Orange', vin: 'KNAPBH813LT123456', fuel_type: 'Diesel', mileage: 41200, mot_due: '2025-07-12', service_due: '2025-08-01' },
    { customer_id: customerIds[9], registration: 'KS21 BCD', make: 'Peugeot', model: '208', year: 2021, colour: 'Green', vin: 'VF3CCYHZPMT123456', fuel_type: 'Electric', mileage: 22100, mot_due: '2024-12-01', service_due: '2025-01-15' },
    { customer_id: customerIds[10], registration: 'TO17 EFG', make: 'Renault', model: 'Megane', year: 2017, colour: 'Silver', vin: 'VF1KZ360H58123456', fuel_type: 'Petrol', mileage: 63400, mot_due: '2025-01-20', service_due: '2025-03-01' },
    { customer_id: customerIds[11], registration: 'AS19 HIJ', make: 'Ford', model: 'Transit Custom', year: 2019, colour: 'White', vin: 'WF0YXXTTGYKD12345', fuel_type: 'Diesel', mileage: 134000, mot_due: '2025-02-28', service_due: '2025-01-01' },
    { customer_id: customerIds[11], registration: 'AS20 KLM', make: 'Ford', model: 'Transit Custom', year: 2020, colour: 'White', vin: 'WF0YXXTTGZLD12345', fuel_type: 'Diesel', mileage: 98000, mot_due: '2025-04-15', service_due: '2025-03-15' },
  ]

  const vehicleIds: number[] = []
  for (const v of vehicleData) {
    const result = insertVehicle.run(v)
    vehicleIds.push(result.lastInsertRowid as number)
  }

  // Seed parts
  const insertPart = db.prepare(`INSERT INTO parts (sku, name, description, supplier, cost_price, sale_price, stock_quantity, min_stock)
    VALUES (@sku, @name, @description, @supplier, @cost_price, @sale_price, @stock_quantity, @min_stock)`)

  const parts = [
    { sku: 'OIL-5W30', name: 'Engine Oil 5W-30 5L', description: 'Fully synthetic', supplier: 'Euro Car Parts', cost_price: 18.50, sale_price: 32.00, stock_quantity: 24, min_stock: 10 },
    { sku: 'OIL-FILT-01', name: 'Oil Filter - Universal', description: 'Fits most VAG/Ford', supplier: 'Euro Car Parts', cost_price: 4.20, sale_price: 9.99, stock_quantity: 15, min_stock: 8 },
    { sku: 'BRK-PAD-FR', name: 'Front Brake Pads - Set', description: 'OEM spec', supplier: 'GSF Car Parts', cost_price: 22.00, sale_price: 45.00, stock_quantity: 8, min_stock: 4 },
    { sku: 'BRK-DSC-FR', name: 'Front Brake Disc - Each', description: 'Vented', supplier: 'GSF Car Parts', cost_price: 35.00, sale_price: 65.00, stock_quantity: 4, min_stock: 2 },
    { sku: 'AIR-FILT-01', name: 'Air Filter - Panel', description: 'High flow', supplier: 'Euro Car Parts', cost_price: 8.50, sale_price: 18.00, stock_quantity: 12, min_stock: 5 },
    { sku: 'SPARK-NGK-01', name: 'Spark Plugs x4 - NGK', description: 'Iridium IX', supplier: 'Euro Car Parts', cost_price: 28.00, sale_price: 55.00, stock_quantity: 6, min_stock: 3 },
    { sku: 'BATT-075', name: 'Battery 075 - 70Ah', description: '3yr warranty', supplier: 'Euro Car Parts', cost_price: 65.00, sale_price: 110.00, stock_quantity: 3, min_stock: 2 },
    { sku: 'COOL-ANT', name: 'Coolant - Antifreeze 5L', description: 'OAT ready-mixed', supplier: 'GSF Car Parts', cost_price: 9.00, sale_price: 18.00, stock_quantity: 10, min_stock: 4 },
    { sku: 'WIPER-FR', name: 'Wiper Blade - Front Pair', description: 'Flat beam', supplier: 'Euro Car Parts', cost_price: 12.00, sale_price: 25.00, stock_quantity: 7, min_stock: 3 },
    { sku: 'TIMING-BELT', name: 'Timing Belt Kit', description: 'Belt + tensioner + pulley', supplier: 'GSF Car Parts', cost_price: 55.00, sale_price: 95.00, stock_quantity: 2, min_stock: 1 },
    { sku: 'TYRE-195-65R15', name: 'Tyre 195/65 R15 - Each', description: 'Budget brand', supplier: 'Tyre King', cost_price: 42.00, sale_price: 75.00, stock_quantity: 8, min_stock: 4 },
    { sku: 'CABLEBR-01', name: 'Handbrake Cable', description: 'Universal rear', supplier: 'GSF Car Parts', cost_price: 14.00, sale_price: 28.00, stock_quantity: 1, min_stock: 2 },
  ]

  const partIds: number[] = []
  for (const p of parts) {
    const result = insertPart.run(p)
    partIds.push(result.lastInsertRowid as number)
  }

  // Seed jobs
  const insertJob = db.prepare(`INSERT INTO jobs (job_number, customer_id, vehicle_id, status, title, description, technician_notes, assigned_to, labour_rate, booked_date, started_date, completed_date)
    VALUES (@job_number, @customer_id, @vehicle_id, @status, @title, @description, @technician_notes, @assigned_to, @labour_rate, @booked_date, @started_date, @completed_date)`)

  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

  const jobs = [
    { job_number: 'JOB-0001', customer_id: customerIds[0], vehicle_id: vehicleIds[0], status: 'complete', title: 'Full Service', description: 'Annual full service', technician_notes: 'Oil and filter changed. Air filter replaced. Brake fluid ok.', assigned_to: 'Dan', labour_rate: 65, booked_date: fmt(addDays(today, -14)), started_date: fmt(addDays(today, -14)), completed_date: fmt(addDays(today, -13)) },
    { job_number: 'JOB-0002', customer_id: customerIds[1], vehicle_id: vehicleIds[1], status: 'invoiced', title: 'Front Brake Pads & Discs', description: 'Replace front pads and discs - worn', technician_notes: 'Both sides done. Handbrake adjusted.', assigned_to: 'Steve', labour_rate: 65, booked_date: fmt(addDays(today, -10)), started_date: fmt(addDays(today, -10)), completed_date: fmt(addDays(today, -9)) },
    { job_number: 'JOB-0003', customer_id: customerIds[2], vehicle_id: vehicleIds[3], status: 'in_progress', title: 'Timing Belt Replacement', description: 'Timing belt due at 100k - currently 98.5k', technician_notes: 'Water pump also being replaced as preventative measure', assigned_to: 'Dan', labour_rate: 65, booked_date: fmt(today), started_date: fmt(today), completed_date: null },
    { job_number: 'JOB-0004', customer_id: customerIds[4], vehicle_id: vehicleIds[5], status: 'booked', title: 'MOT', description: 'Annual MOT test', technician_notes: null, assigned_to: 'Steve', labour_rate: 65, booked_date: fmt(addDays(today, 2)), started_date: null, completed_date: null },
    { job_number: 'JOB-0005', customer_id: customerIds[5], vehicle_id: vehicleIds[6], status: 'awaiting_parts', title: 'Handbrake Cable Replacement', description: 'Handbrake not holding - cable snapped', technician_notes: 'Waiting for replacement cable from GSF', assigned_to: 'Dan', labour_rate: 65, booked_date: fmt(addDays(today, -3)), started_date: fmt(addDays(today, -3)), completed_date: null },
    { job_number: 'JOB-0006', customer_id: customerIds[6], vehicle_id: vehicleIds[7], status: 'booked', title: 'Diagnostic Check + Service', description: 'Engine warning light on. Service overdue.', technician_notes: null, assigned_to: 'Steve', labour_rate: 65, booked_date: fmt(addDays(today, 1)), started_date: null, completed_date: null },
    { job_number: 'JOB-0007', customer_id: customerIds[7], vehicle_id: vehicleIds[8], status: 'complete', title: 'MOT + Brake Repair', description: 'MOT failed on brakes', technician_notes: 'Passed after pads replaced front and rear', assigned_to: 'Dan', labour_rate: 65, booked_date: fmt(addDays(today, -7)), started_date: fmt(addDays(today, -7)), completed_date: fmt(addDays(today, -6)) },
    { job_number: 'JOB-0008', customer_id: customerIds[8], vehicle_id: vehicleIds[9], status: 'in_progress', title: 'Suspension Knock - Investigation', description: 'Knocking from front nearside', technician_notes: 'Lower arm bush worn. Waiting for customer approval on cost.', assigned_to: 'Steve', labour_rate: 65, booked_date: fmt(today), started_date: fmt(today), completed_date: null },
    { job_number: 'JOB-0009', customer_id: customerIds[9], vehicle_id: vehicleIds[10], status: 'invoiced', title: 'Battery Replacement', description: 'Flat battery - AA called us', technician_notes: 'New 70Ah fitted and tested', assigned_to: 'Dan', labour_rate: 65, booked_date: fmt(addDays(today, -5)), started_date: fmt(addDays(today, -5)), completed_date: fmt(addDays(today, -5)) },
    { job_number: 'JOB-0010', customer_id: customerIds[11], vehicle_id: vehicleIds[12], status: 'complete', title: 'Service + Tyres x2', description: 'Interim service and 2 new rear tyres', technician_notes: 'Near-legal on rear tyres. Both replaced.', assigned_to: 'Steve', labour_rate: 65, booked_date: fmt(addDays(today, -2)), started_date: fmt(addDays(today, -2)), completed_date: fmt(addDays(today, -1)) },
    { job_number: 'JOB-0011', customer_id: customerIds[3], vehicle_id: vehicleIds[4], status: 'booked', title: 'Full Service', description: 'Customer requested full service', technician_notes: null, assigned_to: 'Dan', labour_rate: 65, booked_date: fmt(addDays(today, 3)), started_date: null, completed_date: null },
    { job_number: 'JOB-0012', customer_id: customerIds[10], vehicle_id: vehicleIds[11], status: 'complete', title: 'Spark Plugs + Coil Pack', description: 'Misfiring on cylinder 3', technician_notes: 'All 4 plugs replaced. Coil pack on cyl 3 replaced.', assigned_to: 'Dan', labour_rate: 65, booked_date: fmt(addDays(today, -20)), started_date: fmt(addDays(today, -20)), completed_date: fmt(addDays(today, -19)) },
  ]

  const jobIds: number[] = []
  for (const j of jobs) {
    const result = insertJob.run(j)
    jobIds.push(result.lastInsertRowid as number)
  }

  // Seed job line items
  const insertLineItem = db.prepare(`INSERT INTO job_line_items (job_id, type, description, quantity, unit_price, total, part_id)
    VALUES (@job_id, @type, @description, @quantity, @unit_price, @total, @part_id)`)

  const lineItems = [
    // JOB-0001 Full Service
    { job_id: jobIds[0], type: 'labour', description: 'Full service - labour', quantity: 1.5, unit_price: 65, total: 97.50, part_id: null },
    { job_id: jobIds[0], type: 'part', description: 'Engine Oil 5W-30 5L', quantity: 1, unit_price: 32.00, total: 32.00, part_id: partIds[0] },
    { job_id: jobIds[0], type: 'part', description: 'Oil Filter', quantity: 1, unit_price: 9.99, total: 9.99, part_id: partIds[1] },
    { job_id: jobIds[0], type: 'part', description: 'Air Filter', quantity: 1, unit_price: 18.00, total: 18.00, part_id: partIds[4] },
    // JOB-0002 Brake job
    { job_id: jobIds[1], type: 'labour', description: 'Front brake pads & discs - labour', quantity: 2, unit_price: 65, total: 130.00, part_id: null },
    { job_id: jobIds[1], type: 'part', description: 'Front Brake Pads - Set', quantity: 1, unit_price: 45.00, total: 45.00, part_id: partIds[2] },
    { job_id: jobIds[1], type: 'part', description: 'Front Brake Disc x2', quantity: 2, unit_price: 65.00, total: 130.00, part_id: partIds[3] },
    // JOB-0003 Timing belt (in progress)
    { job_id: jobIds[2], type: 'labour', description: 'Timing belt replacement - labour', quantity: 4, unit_price: 65, total: 260.00, part_id: null },
    { job_id: jobIds[2], type: 'part', description: 'Timing Belt Kit', quantity: 1, unit_price: 95.00, total: 95.00, part_id: partIds[9] },
    // JOB-0007 MOT + brakes
    { job_id: jobIds[6], type: 'labour', description: 'MOT Test', quantity: 1, unit_price: 54.85, total: 54.85, part_id: null },
    { job_id: jobIds[6], type: 'labour', description: 'Brake pad replacement - labour', quantity: 1.5, unit_price: 65, total: 97.50, part_id: null },
    { job_id: jobIds[6], type: 'part', description: 'Front Brake Pads - Set', quantity: 1, unit_price: 45.00, total: 45.00, part_id: partIds[2] },
    // JOB-0009 Battery
    { job_id: jobIds[8], type: 'labour', description: 'Battery replacement - labour', quantity: 0.5, unit_price: 65, total: 32.50, part_id: null },
    { job_id: jobIds[8], type: 'part', description: 'Battery 075 - 70Ah', quantity: 1, unit_price: 110.00, total: 110.00, part_id: partIds[6] },
    // JOB-0010 Service + tyres
    { job_id: jobIds[9], type: 'labour', description: 'Interim service - labour', quantity: 1, unit_price: 65, total: 65.00, part_id: null },
    { job_id: jobIds[9], type: 'part', description: 'Engine Oil 5W-30', quantity: 1, unit_price: 32.00, total: 32.00, part_id: partIds[0] },
    { job_id: jobIds[9], type: 'part', description: 'Tyres 195/65 R15 x2', quantity: 2, unit_price: 75.00, total: 150.00, part_id: partIds[10] },
    { job_id: jobIds[9], type: 'labour', description: 'Tyre fitting x2', quantity: 0.5, unit_price: 65, total: 32.50, part_id: null },
    // JOB-0012 Spark plugs
    { job_id: jobIds[11], type: 'labour', description: 'Spark plugs + coil pack - labour', quantity: 1.5, unit_price: 65, total: 97.50, part_id: null },
    { job_id: jobIds[11], type: 'part', description: 'Spark Plugs x4 - NGK Iridium', quantity: 1, unit_price: 55.00, total: 55.00, part_id: partIds[5] },
  ]

  for (const item of lineItems) {
    insertLineItem.run(item)
  }

  // Seed invoices for completed/invoiced jobs
  const insertInvoice = db.prepare(`INSERT INTO invoices (invoice_number, job_id, customer_id, status, subtotal, vat_rate, vat_amount, total, due_date, paid_date)
    VALUES (@invoice_number, @job_id, @customer_id, @status, @subtotal, @vat_rate, @vat_amount, @total, @due_date, @paid_date)`)

  const insertInvLine = db.prepare(`INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total)
    VALUES (@invoice_id, @description, @quantity, @unit_price, @total)`)

  const invoiceData = [
    { invoice_number: 'INV-1001', job_id: jobIds[0], customer_id: customerIds[0], status: 'paid', subtotal: 157.49, vat_rate: 20, vat_amount: 31.50, total: 188.99, due_date: fmt(addDays(today, -7)), paid_date: fmt(addDays(today, -6)) },
    { invoice_number: 'INV-1002', job_id: jobIds[1], customer_id: customerIds[1], status: 'unpaid', subtotal: 305.00, vat_rate: 20, vat_amount: 61.00, total: 366.00, due_date: fmt(addDays(today, 7)), paid_date: null },
    { invoice_number: 'INV-1003', job_id: jobIds[6], customer_id: customerIds[7], status: 'paid', subtotal: 197.35, vat_rate: 20, vat_amount: 39.47, total: 236.82, due_date: fmt(addDays(today, -1)), paid_date: fmt(today) },
    { invoice_number: 'INV-1004', job_id: jobIds[8], customer_id: customerIds[9], status: 'paid', subtotal: 142.50, vat_rate: 20, vat_amount: 28.50, total: 171.00, due_date: fmt(addDays(today, -2)), paid_date: fmt(addDays(today, -1)) },
    { invoice_number: 'INV-1005', job_id: jobIds[9], customer_id: customerIds[11], status: 'unpaid', subtotal: 279.50, vat_rate: 20, vat_amount: 55.90, total: 335.40, due_date: fmt(addDays(today, 14)), paid_date: null },
    { invoice_number: 'INV-1006', job_id: jobIds[11], customer_id: customerIds[10], status: 'paid', subtotal: 152.50, vat_rate: 20, vat_amount: 30.50, total: 183.00, due_date: fmt(addDays(today, -12)), paid_date: fmt(addDays(today, -10)) },
  ]

  for (const inv of invoiceData) {
    const result = insertInvoice.run(inv)
    const invId = result.lastInsertRowid as number
    // Add a summary line
    insertInvLine.run({ invoice_id: invId, description: 'See job details', quantity: 1, unit_price: inv.subtotal, total: inv.subtotal })
  }

  // Seed bookings
  const insertBooking = db.prepare(`INSERT INTO bookings (customer_id, vehicle_id, job_id, title, start_time, end_time, notes, status)
    VALUES (@customer_id, @vehicle_id, @job_id, @title, @start_time, @end_time, @notes, @status)`)

  const fmtDT = (d: Date, h: number, m = 0) => {
    const x = new Date(d)
    x.setHours(h, m, 0, 0)
    return x.toISOString()
  }

  const bookings = [
    { customer_id: customerIds[0], vehicle_id: vehicleIds[0], job_id: jobIds[0], title: 'Full Service - Harrison BD21 XYZ', start_time: fmtDT(addDays(today, -14), 9), end_time: fmtDT(addDays(today, -14), 11), notes: '', status: 'completed' },
    { customer_id: customerIds[1], vehicle_id: vehicleIds[1], job_id: jobIds[1], title: 'Brake Work - Mitchell SL19 ABC', start_time: fmtDT(addDays(today, -10), 10), end_time: fmtDT(addDays(today, -10), 12), notes: '', status: 'completed' },
    { customer_id: customerIds[2], vehicle_id: vehicleIds[3], job_id: jobIds[2], title: 'Timing Belt - Clarke DC15 GHI', start_time: fmtDT(today, 8), end_time: fmtDT(today, 12), notes: 'Allow 4 hours minimum', status: 'confirmed' },
    { customer_id: customerIds[4], vehicle_id: vehicleIds[5], job_id: jobIds[3], title: 'MOT - Wilson RW18 MNO', start_time: fmtDT(addDays(today, 2), 9), end_time: fmtDT(addDays(today, 2), 10, 30), notes: '', status: 'confirmed' },
    { customer_id: customerIds[6], vehicle_id: vehicleIds[7], job_id: jobIds[5], title: 'Diagnostic + Service - Brown MB23 STU', start_time: fmtDT(addDays(today, 1), 14), end_time: fmtDT(addDays(today, 1), 16), notes: 'Engine warning light', status: 'confirmed' },
    { customer_id: customerIds[3], vehicle_id: vehicleIds[4], job_id: jobIds[10], title: 'Full Service - Thompson ET22 JKL', start_time: fmtDT(addDays(today, 3), 9), end_time: fmtDT(addDays(today, 3), 11), notes: '', status: 'confirmed' },
    { customer_id: customerIds[8], vehicle_id: vehicleIds[9], job_id: jobIds[7], title: 'Suspension Check - Johnson PJ20 YZA', start_time: fmtDT(today, 13), end_time: fmtDT(today, 14, 30), notes: 'Knocking from front nearside', status: 'confirmed' },
  ]

  for (const b of bookings) {
    insertBooking.run(b)
  }

  // Seed quotes
  const insertQuote = db.prepare(`INSERT INTO quotes (quote_number, customer_id, vehicle_id, status, title, subtotal, vat_rate, vat_amount, total, valid_until)
    VALUES (@quote_number, @customer_id, @vehicle_id, @status, @title, @subtotal, @vat_rate, @vat_amount, @total, @valid_until)`)

  const quotesData = [
    { quote_number: 'QUO-1001', customer_id: customerIds[5], vehicle_id: vehicleIds[6], status: 'sent', title: 'Clutch Replacement', subtotal: 420.00, vat_rate: 20, vat_amount: 84.00, total: 504.00, valid_until: fmt(addDays(today, 14)) },
    { quote_number: 'QUO-1002', customer_id: customerIds[11], vehicle_id: vehicleIds[12], status: 'draft', title: 'Full Brake Overhaul - Transit', subtotal: 650.00, vat_rate: 20, vat_amount: 130.00, total: 780.00, valid_until: fmt(addDays(today, 21)) },
    { quote_number: 'QUO-1003', customer_id: customerIds[9], vehicle_id: vehicleIds[10], status: 'accepted', title: 'Annual Service Package', subtotal: 195.00, vat_rate: 20, vat_amount: 39.00, total: 234.00, valid_until: fmt(addDays(today, 7)) },
  ]

  for (const q of quotesData) {
    insertQuote.run(q)
  }
}
