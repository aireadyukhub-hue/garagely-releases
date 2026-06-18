import { ipcMain } from 'electron'
import { WDB } from './db-wrapper'

export function registerIpcHandlers(db: WDB) {
  // ─── Settings ───────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => {
    return db.prepare('SELECT * FROM settings WHERE id = 1').get()
  })

  ipcMain.handle('settings:update', (_e, data) => {
    const keys = Object.keys(data).filter(k => k !== 'id')
    const set = keys.map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE settings SET ${set}, updated_at = datetime('now') WHERE id = 1`).run(data)
    return db.prepare('SELECT * FROM settings WHERE id = 1').get()
  })

  // ─── Customers ──────────────────────────────────────────────────────────
  ipcMain.handle('customers:getAll', () => {
    return db.prepare(`
      SELECT c.*,
        COUNT(DISTINCT v.id) as vehicle_count,
        COUNT(DISTINCT j.id) as job_count
      FROM customers c
      LEFT JOIN vehicles v ON v.customer_id = c.id
      LEFT JOIN jobs j ON j.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.last_name, c.first_name
    `).all()
  })

  ipcMain.handle('customers:get', (_e, id) => {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE customer_id = ? ORDER BY registration').all(id)
    const jobs = db.prepare(`
      SELECT j.*, v.registration, v.make, v.model
      FROM jobs j
      LEFT JOIN vehicles v ON v.id = j.vehicle_id
      WHERE j.customer_id = ?
      ORDER BY j.created_at DESC
    `).all(id)
    return { customer, vehicles, jobs }
  })

  ipcMain.handle('customers:create', (_e, data) => {
    const r = db.prepare(`INSERT INTO customers (first_name, last_name, email, phone, mobile, address, city, postcode, notes)
      VALUES (@first_name, @last_name, @email, @phone, @mobile, @address, @city, @postcode, @notes)`).run(data)
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(r.lastInsertRowid)
  })

  ipcMain.handle('customers:update', (_e, id, data) => {
    const keys = Object.keys(data).filter(k => k !== 'id')
    const set = keys.map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE customers SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id })
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
  })

  ipcMain.handle('customers:delete', (_e, id) => {
    db.prepare('DELETE FROM customers WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── Vehicles ───────────────────────────────────────────────────────────
  ipcMain.handle('vehicles:getAll', (_e, customerId) => {
    if (customerId) {
      return db.prepare(`
        SELECT v.*, c.first_name, c.last_name
        FROM vehicles v JOIN customers c ON c.id = v.customer_id
        WHERE v.customer_id = ? ORDER BY v.registration
      `).all(customerId)
    }
    return db.prepare(`
      SELECT v.*, c.first_name, c.last_name
      FROM vehicles v JOIN customers c ON c.id = v.customer_id
      ORDER BY v.registration
    `).all()
  })

  ipcMain.handle('vehicles:get', (_e, id) => {
    const vehicle = db.prepare(`
      SELECT v.*, c.first_name, c.last_name, c.email, c.phone, c.mobile
      FROM vehicles v JOIN customers c ON c.id = v.customer_id
      WHERE v.id = ?
    `).get(id)
    const jobs = db.prepare(`
      SELECT j.* FROM jobs j WHERE j.vehicle_id = ? ORDER BY j.created_at DESC
    `).all(id)
    const serviceHistory = db.prepare(`
      SELECT j.completed_date, j.title, j.technician_notes, j.status
      FROM jobs j WHERE j.vehicle_id = ? AND j.completed_date IS NOT NULL
      ORDER BY j.completed_date DESC
    `).all(id)
    return { vehicle, jobs, serviceHistory }
  })

  ipcMain.handle('vehicles:create', (_e, data) => {
    const r = db.prepare(`INSERT INTO vehicles (customer_id, registration, make, model, year, colour, vin, engine_size, fuel_type, mileage, mot_due, service_due, notes)
      VALUES (@customer_id, @registration, @make, @model, @year, @colour, @vin, @engine_size, @fuel_type, @mileage, @mot_due, @service_due, @notes)`).run(data)
    return db.prepare('SELECT * FROM vehicles WHERE id = ?').get(r.lastInsertRowid)
  })

  ipcMain.handle('vehicles:update', (_e, id, data) => {
    const keys = Object.keys(data).filter(k => k !== 'id')
    const set = keys.map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE vehicles SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id })
    return db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)
  })

  ipcMain.handle('vehicles:delete', (_e, id) => {
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── Jobs ───────────────────────────────────────────────────────────────
  ipcMain.handle('jobs:getAll', (_e, filters) => {
    let query = `
      SELECT j.*,
        c.first_name, c.last_name,
        v.registration, v.make, v.model,
        COALESCE(SUM(li.total), 0) as total_value
      FROM jobs j
      LEFT JOIN customers c ON c.id = j.customer_id
      LEFT JOIN vehicles v ON v.id = j.vehicle_id
      LEFT JOIN job_line_items li ON li.job_id = j.id
    `
    const conditions: string[] = []
    const params: unknown[] = []

    if (filters?.status) { conditions.push('j.status = ?'); params.push(filters.status) }
    if (filters?.customerId) { conditions.push('j.customer_id = ?'); params.push(filters.customerId) }
    if (filters?.search) {
      conditions.push('(j.title LIKE ? OR j.job_number LIKE ? OR c.last_name LIKE ? OR v.registration LIKE ?)')
      const s = `%${filters.search}%`
      params.push(s, s, s, s)
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
    query += ' GROUP BY j.id ORDER BY j.created_at DESC'

    return db.prepare(query).all(...params)
  })

  ipcMain.handle('jobs:get', (_e, id) => {
    const job = db.prepare(`
      SELECT j.*, c.first_name, c.last_name, c.email, c.phone, c.mobile,
        v.registration, v.make, v.model, v.year, v.colour, v.mileage
      FROM jobs j
      LEFT JOIN customers c ON c.id = j.customer_id
      LEFT JOIN vehicles v ON v.id = j.vehicle_id
      WHERE j.id = ?
    `).get(id)
    const lineItems = db.prepare('SELECT * FROM job_line_items WHERE job_id = ? ORDER BY id').all(id)
    return { job, lineItems }
  })

  ipcMain.handle('jobs:create', (_e, data) => {
    // Auto-generate job number
    const last = db.prepare("SELECT job_number FROM jobs ORDER BY id DESC LIMIT 1").get() as { job_number: string } | undefined
    let nextNum = 1
    if (last) {
      const parts = last.job_number.split('-')
      nextNum = parseInt(parts[1] || '0') + 1
    }
    const job_number = `JOB-${String(nextNum).padStart(4, '0')}`
    const r = db.prepare(`INSERT INTO jobs (job_number, customer_id, vehicle_id, status, title, description, assigned_to, labour_rate, booked_date)
      VALUES (@job_number, @customer_id, @vehicle_id, @status, @title, @description, @assigned_to, @labour_rate, @booked_date)`)
      .run({ ...data, job_number })
    return db.prepare(`SELECT j.*, c.first_name, c.last_name, v.registration, v.make, v.model FROM jobs j
      LEFT JOIN customers c ON c.id = j.customer_id LEFT JOIN vehicles v ON v.id = j.vehicle_id WHERE j.id = ?`).get(r.lastInsertRowid)
  })

  ipcMain.handle('jobs:update', (_e, id, data) => {
    const keys = Object.keys(data).filter(k => k !== 'id')
    const set = keys.map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE jobs SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id })
    return db.prepare(`SELECT j.*, c.first_name, c.last_name, v.registration, v.make, v.model FROM jobs j
      LEFT JOIN customers c ON c.id = j.customer_id LEFT JOIN vehicles v ON v.id = j.vehicle_id WHERE j.id = ?`).get(id)
  })

  ipcMain.handle('jobs:delete', (_e, id) => {
    db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('jobLineItems:get', (_e, jobId) => {
    return db.prepare('SELECT * FROM job_line_items WHERE job_id = ? ORDER BY id').all(jobId)
  })

  ipcMain.handle('jobLineItems:save', (_e, jobId, items) => {
    db.prepare('DELETE FROM job_line_items WHERE job_id = ?').run(jobId)
    const insert = db.prepare(`INSERT INTO job_line_items (job_id, type, description, quantity, unit_price, total, part_id)
      VALUES (@job_id, @type, @description, @quantity, @unit_price, @total, @part_id)`)
    for (const item of items) {
      insert.run({ ...item, job_id: jobId })
    }
    return db.prepare('SELECT * FROM job_line_items WHERE job_id = ? ORDER BY id').all(jobId)
  })

  // ─── Invoices ───────────────────────────────────────────────────────────
  ipcMain.handle('invoices:getAll', (_e, filters) => {
    let query = `
      SELECT i.*, c.first_name, c.last_name, j.job_number, j.title as job_title
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN jobs j ON j.id = i.job_id
    `
    const conditions: string[] = []
    const params: unknown[] = []
    if (filters?.status) { conditions.push('i.status = ?'); params.push(filters.status) }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
    query += ' ORDER BY i.created_at DESC'
    return db.prepare(query).all(...params)
  })

  ipcMain.handle('invoices:get', (_e, id) => {
    const invoice = db.prepare(`
      SELECT i.*, c.first_name, c.last_name, c.email, c.address, c.city, c.postcode,
        j.job_number, j.title as job_title, v.registration, v.make, v.model
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN jobs j ON j.id = i.job_id
      LEFT JOIN vehicles v ON v.id = j.vehicle_id
      WHERE i.id = ?
    `).get(id)
    const lineItems = db.prepare('SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY id').all(id)
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get()
    return { invoice, lineItems, settings }
  })

  ipcMain.handle('invoices:create', (_e, data) => {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as { invoice_prefix: string; invoice_next: number }
    const invoice_number = `${settings.invoice_prefix}-${settings.invoice_next}`
    db.prepare('UPDATE settings SET invoice_next = invoice_next + 1 WHERE id = 1').run()
    const r = db.prepare(`INSERT INTO invoices (invoice_number, job_id, customer_id, status, subtotal, vat_rate, vat_amount, total, notes, due_date)
      VALUES (@invoice_number, @job_id, @customer_id, @status, @subtotal, @vat_rate, @vat_amount, @total, @notes, @due_date)`)
      .run({ ...data, invoice_number })
    const invId = r.lastInsertRowid as number
    if (data.lineItems?.length) {
      const insert = db.prepare('INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total) VALUES (@invoice_id, @description, @quantity, @unit_price, @total)')
      for (const item of data.lineItems) {
        insert.run({ ...item, invoice_id: invId })
      }
    }
    return db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId)
  })

  ipcMain.handle('invoices:update', (_e, id, data) => {
    const keys = Object.keys(data).filter(k => !['id', 'lineItems'].includes(k))
    const set = keys.map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE invoices SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id })
    return db.prepare('SELECT * FROM invoices WHERE id = ?').get(id)
  })

  ipcMain.handle('invoices:delete', (_e, id) => {
    db.prepare('DELETE FROM invoices WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── Quotes ─────────────────────────────────────────────────────────────
  ipcMain.handle('quotes:getAll', () => {
    return db.prepare(`
      SELECT q.*, c.first_name, c.last_name, v.registration, v.make, v.model
      FROM quotes q
      LEFT JOIN customers c ON c.id = q.customer_id
      LEFT JOIN vehicles v ON v.id = q.vehicle_id
      ORDER BY q.created_at DESC
    `).all()
  })

  ipcMain.handle('quotes:get', (_e, id) => {
    const quote = db.prepare(`
      SELECT q.*, c.first_name, c.last_name, c.email, c.address, c.city, c.postcode,
        v.registration, v.make, v.model
      FROM quotes q
      LEFT JOIN customers c ON c.id = q.customer_id
      LEFT JOIN vehicles v ON v.id = q.vehicle_id
      WHERE q.id = ?
    `).get(id)
    const lineItems = db.prepare('SELECT * FROM quote_line_items WHERE quote_id = ? ORDER BY id').all(id)
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get()
    return { quote, lineItems, settings }
  })

  ipcMain.handle('quotes:create', (_e, data) => {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as { quote_prefix: string; quote_next: number }
    const quote_number = `${settings.quote_prefix}-${settings.quote_next}`
    db.prepare('UPDATE settings SET quote_next = quote_next + 1 WHERE id = 1').run()
    const r = db.prepare(`INSERT INTO quotes (quote_number, customer_id, vehicle_id, status, title, subtotal, vat_rate, vat_amount, total, notes, valid_until)
      VALUES (@quote_number, @customer_id, @vehicle_id, @status, @title, @subtotal, @vat_rate, @vat_amount, @total, @notes, @valid_until)`)
      .run({ ...data, quote_number })
    const qId = r.lastInsertRowid as number
    if (data.lineItems?.length) {
      const insert = db.prepare('INSERT INTO quote_line_items (quote_id, description, quantity, unit_price, total) VALUES (@quote_id, @description, @quantity, @unit_price, @total)')
      for (const item of data.lineItems) {
        insert.run({ ...item, quote_id: qId })
      }
    }
    return db.prepare('SELECT * FROM quotes WHERE id = ?').get(qId)
  })

  ipcMain.handle('quotes:update', (_e, id, data) => {
    const keys = Object.keys(data).filter(k => !['id', 'lineItems'].includes(k))
    const set = keys.map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE quotes SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id })
    return db.prepare('SELECT * FROM quotes WHERE id = ?').get(id)
  })

  ipcMain.handle('quotes:delete', (_e, id) => {
    db.prepare('DELETE FROM quotes WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('quotes:convertToJob', (_e, quoteId) => {
    const { quote, lineItems } = db.prepare(`
      SELECT q.*, c.first_name, c.last_name FROM quotes q LEFT JOIN customers c ON c.id = q.customer_id WHERE q.id = ?
    `).get(quoteId) as { quote: { id: number; customer_id: number; vehicle_id: number; title: string; subtotal: number }; lineItems: unknown[] } | { quote: unknown; lineItems: unknown[] }

    // Create job from quote
    const last = db.prepare("SELECT job_number FROM jobs ORDER BY id DESC LIMIT 1").get() as { job_number: string } | undefined
    let nextNum = 1
    if (last) { const p = last.job_number.split('-'); nextNum = parseInt(p[1] || '0') + 1 }
    const job_number = `JOB-${String(nextNum).padStart(4, '0')}`

    const q = quote as { customer_id: number; vehicle_id: number; title: string }
    const r = db.prepare(`INSERT INTO jobs (job_number, customer_id, vehicle_id, status, title, labour_rate)
      VALUES (?, ?, ?, 'booked', ?, 65)`).run(job_number, q.customer_id, q.vehicle_id, q.title)
    const jobId = r.lastInsertRowid as number

    db.prepare('UPDATE quotes SET status = ?, converted_job_id = ? WHERE id = ?').run('converted', jobId, quoteId)
    return db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId)
  })

  // ─── Bookings ───────────────────────────────────────────────────────────
  ipcMain.handle('bookings:getAll', (_e, filters) => {
    let query = `
      SELECT b.*, c.first_name, c.last_name, v.registration, v.make, v.model
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN vehicles v ON v.id = b.vehicle_id
    `
    const conditions: string[] = []
    const params: unknown[] = []
    if (filters?.from) { conditions.push('b.start_time >= ?'); params.push(filters.from) }
    if (filters?.to) { conditions.push('b.start_time <= ?'); params.push(filters.to) }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
    query += ' ORDER BY b.start_time'
    return db.prepare(query).all(...params)
  })

  ipcMain.handle('bookings:get', (_e, id) => {
    return db.prepare(`
      SELECT b.*, c.first_name, c.last_name, v.registration, v.make, v.model
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN vehicles v ON v.id = b.vehicle_id
      WHERE b.id = ?
    `).get(id)
  })

  ipcMain.handle('bookings:create', (_e, data) => {
    const r = db.prepare(`INSERT INTO bookings (customer_id, vehicle_id, job_id, title, start_time, end_time, notes, status)
      VALUES (@customer_id, @vehicle_id, @job_id, @title, @start_time, @end_time, @notes, @status)`).run(data)
    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(r.lastInsertRowid)
  })

  ipcMain.handle('bookings:update', (_e, id, data) => {
    const keys = Object.keys(data).filter(k => k !== 'id')
    const set = keys.map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE bookings SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id })
    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(id)
  })

  ipcMain.handle('bookings:delete', (_e, id) => {
    db.prepare('DELETE FROM bookings WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── Parts ──────────────────────────────────────────────────────────────
  ipcMain.handle('parts:getAll', () => {
    return db.prepare('SELECT * FROM parts ORDER BY name').all()
  })

  ipcMain.handle('parts:get', (_e, id) => {
    return db.prepare('SELECT * FROM parts WHERE id = ?').get(id)
  })

  ipcMain.handle('parts:create', (_e, data) => {
    const r = db.prepare(`INSERT INTO parts (sku, name, description, supplier, cost_price, sale_price, stock_quantity, min_stock, location)
      VALUES (@sku, @name, @description, @supplier, @cost_price, @sale_price, @stock_quantity, @min_stock, @location)`).run(data)
    return db.prepare('SELECT * FROM parts WHERE id = ?').get(r.lastInsertRowid)
  })

  ipcMain.handle('parts:update', (_e, id, data) => {
    const keys = Object.keys(data).filter(k => k !== 'id')
    const set = keys.map(k => `${k} = @${k}`).join(', ')
    db.prepare(`UPDATE parts SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id })
    return db.prepare('SELECT * FROM parts WHERE id = ?').get(id)
  })

  ipcMain.handle('parts:delete', (_e, id) => {
    db.prepare('DELETE FROM parts WHERE id = ?').run(id)
    return { success: true }
  })

  // ─── Dashboard ──────────────────────────────────────────────────────────
  ipcMain.handle('dashboard:getData', () => {
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.substring(0, 7) + '-01'
    const lastMonthStart = (() => {
      const d = new Date(today)
      d.setMonth(d.getMonth() - 1)
      return d.toISOString().substring(0, 7) + '-01'
    })()
    const lastMonthEnd = (() => {
      const d = new Date(today)
      d.setDate(0)
      return d.toISOString().split('T')[0]
    })()

    const todayBookings = db.prepare(`
      SELECT b.*, c.first_name, c.last_name, v.registration, v.make, v.model
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN vehicles v ON v.id = b.vehicle_id
      WHERE date(b.start_time) = ? ORDER BY b.start_time
    `).all(today)

    const jobsInProgress = db.prepare(`
      SELECT j.*, c.first_name, c.last_name, v.registration, v.make, v.model
      FROM jobs j
      LEFT JOIN customers c ON c.id = j.customer_id
      LEFT JOIN vehicles v ON v.id = j.vehicle_id
      WHERE j.status IN ('in_progress', 'awaiting_parts')
      ORDER BY j.updated_at DESC
    `).all()

    const revenueThisMonth = (db.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue FROM invoices
      WHERE status = 'paid' AND date(paid_date) >= ?
    `).get(monthStart) as { revenue: number }).revenue

    const revenueLastMonth = (db.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue FROM invoices
      WHERE status = 'paid' AND date(paid_date) BETWEEN ? AND ?
    `).get(lastMonthStart, lastMonthEnd) as { revenue: number }).revenue

    const outstandingInvoices = (db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'unpaid'
    `).get() as { count: number; total: number })

    const motAlerts = db.prepare(`
      SELECT v.*, c.first_name, c.last_name
      FROM vehicles v JOIN customers c ON c.id = v.customer_id
      WHERE v.mot_due IS NOT NULL AND v.mot_due <= date('now', '+30 days')
      ORDER BY v.mot_due
    `).all()

    const serviceAlerts = db.prepare(`
      SELECT v.*, c.first_name, c.last_name
      FROM vehicles v JOIN customers c ON c.id = v.customer_id
      WHERE v.service_due IS NOT NULL AND v.service_due <= date('now', '+30 days')
      ORDER BY v.service_due
    `).all()

    const recentJobs = db.prepare(`
      SELECT j.*, c.first_name, c.last_name, v.registration, v.make, v.model
      FROM jobs j
      LEFT JOIN customers c ON c.id = j.customer_id
      LEFT JOIN vehicles v ON v.id = j.vehicle_id
      ORDER BY j.updated_at DESC LIMIT 5
    `).all()

    const jobStatusCounts = db.prepare(`
      SELECT status, COUNT(*) as count FROM jobs GROUP BY status
    `).all()

    return {
      todayBookings,
      jobsInProgress,
      revenueThisMonth,
      revenueLastMonth,
      outstandingInvoices,
      motAlerts,
      serviceAlerts,
      recentJobs,
      jobStatusCounts,
    }
  })

  // ─── Reports ────────────────────────────────────────────────────────────
  ipcMain.handle('reports:revenue', (_e, from, to) => {
    const daily = db.prepare(`
      SELECT date(paid_date) as date, SUM(total) as revenue, COUNT(*) as invoice_count
      FROM invoices WHERE status = 'paid' AND date(paid_date) BETWEEN ? AND ?
      GROUP BY date(paid_date) ORDER BY date
    `).all(from, to)

    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count, SUM(total) as total FROM invoices
      WHERE date(created_at) BETWEEN ? AND ?
      GROUP BY status
    `).all(from, to)

    const total = (db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = 'paid' AND date(paid_date) BETWEEN ? AND ?
    `).get(from, to) as { total: number }).total

    return { daily, byStatus, total }
  })

  ipcMain.handle('reports:jobs', (_e, from, to) => {
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM jobs
      WHERE date(created_at) BETWEEN ? AND ?
      GROUP BY status
    `).all(from, to)

    const byTechnician = db.prepare(`
      SELECT assigned_to, COUNT(*) as count FROM jobs
      WHERE date(created_at) BETWEEN ? AND ?
      GROUP BY assigned_to
    `).all(from, to)

    const recent = db.prepare(`
      SELECT j.*, c.first_name, c.last_name, v.registration
      FROM jobs j
      LEFT JOIN customers c ON c.id = j.customer_id
      LEFT JOIN vehicles v ON v.id = j.vehicle_id
      WHERE date(j.created_at) BETWEEN ? AND ?
      ORDER BY j.created_at DESC
    `).all(from, to)

    return { byStatus, byTechnician, recent }
  })
}
