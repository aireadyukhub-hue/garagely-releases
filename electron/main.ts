import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import path from 'path'
import { autoUpdater } from 'electron-updater'
import { initDatabase } from './database'
import { registerIpcHandlers } from './ipc'
import { initLicencePath, checkLicenceOnStartup, activateLicence, clearLocalLicence } from './licence'
import type { LicenceInfo } from './licence'

// Only use the Vite dev server when explicitly running `npm run dev` (which
// sets NODE_ENV=development). A packaged build has no NODE_ENV, so it always
// loads its bundled files — never the dev server (which caused the blank screen).
const isDev = process.env.NODE_ENV === 'development' && !app.isPackaged

let mainWindow: BrowserWindow | null = null
let currentLicence: LicenceInfo | null = null

// ─── Auto-updater config ────────────────────────────────────────────────────

function setupAutoUpdater(): void {
  if (isDev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', { version: info.version })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message)
  })

  // Check for updates 10 seconds after launch (don't block startup)
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Silently ignore — user may be offline
    })
  }, 10_000)
}

// ─── Window creation ─────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#16181D',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Right-click context menu with Cut/Copy/Paste/Select All. Electron has no
  // native edit menu by default, so right-click → Paste didn't work (only Ctrl/Cmd+V).
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const { isEditable, editFlags, selectionText } = params
    if (!isEditable && !selectionText) return
    const template: MenuItemConstructorOptions[] = isEditable
      ? [
          { role: 'cut', enabled: editFlags.canCut },
          { role: 'copy', enabled: editFlags.canCopy },
          { role: 'paste', enabled: editFlags.canPaste },
          { type: 'separator' },
          { role: 'selectAll' },
        ]
      : [{ role: 'copy' }]
    Menu.buildFromTemplate(template).popup({ window: mainWindow! })
  })
}

// ─── Licence IPC handlers ─────────────────────────────────────────────────────

function registerLicenceHandlers(): void {
  ipcMain.handle('licence:get', () => currentLicence)

  ipcMain.handle('licence:activate', async (_event, key: string) => {
    const result = await activateLicence(key)
    if (result.success && result.licence) {
      currentLicence = result.licence
    }
    return result
  })

  ipcMain.handle('licence:deactivate', () => {
    clearLocalLicence()
    currentLicence = null
    // Restart so the activation screen re-appears
    app.relaunch()
    app.quit()
    return { success: true }
  })

  // Renderer asks: install the downloaded update now
  ipcMain.handle('update:installNow', () => {
    autoUpdater.quitAndInstall()
  })
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData')

  // Initialise licence path before anything else
  initLicencePath(userDataPath)

  // Validate licence (checks backend, falls back to local)
  currentLicence = await checkLicenceOnStartup()

  // Boot database and register all IPC handlers regardless of licence state
  // (the renderer will show the activation screen if licence is null)
  const db = await initDatabase(userDataPath)
  registerIpcHandlers(db)
  registerLicenceHandlers()

  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
