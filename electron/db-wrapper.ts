/**
 * Thin better-sqlite3-compatible wrapper around sql.js.
 * sql.js is pure JavaScript (no native compilation required).
 * API surface matches what database.ts and ipc.ts use.
 */
import path from 'path'
import fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDB = any

// ── Convert @paramName → :paramName in SQL ──────────────────────────────────
function fixSQL(sql: string): string {
  return sql.replace(/@(\w+)/g, ':$1')
}

// ── Convert call args to sql.js bind format ──────────────────────────────────
function toBindParams(args: unknown[]): unknown {
  if (args.length === 0) return undefined

  // Single plain object → named params { ':key': value }
  if (
    args.length === 1 &&
    args[0] !== null &&
    args[0] !== undefined &&
    typeof args[0] === 'object' &&
    !Array.isArray(args[0])
  ) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(args[0] as Record<string, unknown>)) {
      out[`:${k}`] = v
    }
    return out
  }

  // Positional (single primitive or multiple values)
  return args
}

// ── Statement proxy ──────────────────────────────────────────────────────────
class WStatement {
  private _sql: string
  private _db: WDB

  constructor(sql: string, db: WDB) {
    this._sql = fixSQL(sql)
    this._db = db
  }

  run(...args: unknown[]): { lastInsertRowid: number; changes: number } {
    const params = toBindParams(args)
    this._db._run(this._sql, params)
    const rowid = (this._db._one('SELECT last_insert_rowid() as r') as { r: number } | undefined)?.r ?? 0
    const changes = (this._db._one('SELECT changes() as c') as { c: number } | undefined)?.c ?? 0
    this._db._save()
    return { lastInsertRowid: rowid, changes }
  }

  get(...args: unknown[]): unknown {
    return this._db._one(this._sql, toBindParams(args))
  }

  all(...args: unknown[]): unknown[] {
    return this._db._all(this._sql, toBindParams(args))
  }
}

// ── Database proxy ───────────────────────────────────────────────────────────
export class WDB {
  private _db: AnyDB
  private _path: string

  constructor(sqlJsDb: AnyDB, dbPath: string) {
    this._db = sqlJsDb
    this._path = dbPath
  }

  prepare(sql: string): WStatement {
    return new WStatement(sql, this)
  }

  exec(sql: string): void {
    this._db.exec(sql)
    this._save()
  }

  pragma(stmt: string): void {
    try { this._db.run(`PRAGMA ${stmt}`) } catch { /* ignore unsupported pragmas */ }
  }

  // ── Internal helpers (called by WStatement) ────────────────────────────────
  _run(sql: string, params?: unknown): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._db.run(sql, params as any)
  }

  _one(sql: string, params?: unknown): unknown {
    const stmt = this._db.prepare(sql)
    try {
      if (params !== undefined) stmt.bind(params)
      return stmt.step() ? stmt.getAsObject() : undefined
    } finally {
      stmt.free()
    }
  }

  _all(sql: string, params?: unknown): unknown[] {
    const rows: unknown[] = []
    const stmt = this._db.prepare(sql)
    try {
      if (params !== undefined) stmt.bind(params)
      while (stmt.step()) rows.push(stmt.getAsObject())
    } finally {
      stmt.free()
    }
    return rows
  }

  _save(): void {
    const buf = Buffer.from(this._db.export())
    fs.writeFileSync(this._path, buf)
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────
export async function openDB(dbPath: string): Promise<WDB> {
  // Locate the sql.js WASM file relative to the package
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const initSqlJs: (cfg?: object) => Promise<AnyDB> = require('sql.js')
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(path.dirname(require.resolve('sql.js')), file),
  })

  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const sqlJsDb = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database()

  return new WDB(sqlJsDb, dbPath)
}
