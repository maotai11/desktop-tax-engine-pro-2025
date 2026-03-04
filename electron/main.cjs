const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, dbApi } = require('./db.cjs');
const { createInitStatusTracker } = require('./init-status.cjs');
const { runCalculation } = require('./calculators.cjs');
const { exportPdfReport, exportExcelReport } = require('./export.cjs');
const { verifyUpdatePackage, applyUpdatePackage } = require('./update-package.cjs');
const { getLaborFormSchemas, downloadOfficialForm, exportLaborNhiMappedWord, exportLaborNhiDraftWord, exportLaborNhiPdf, exportLaborNhiOverlayPdf } = require('./labor-forms.cjs');
const { lookupRegistryByTaxId } = require('./public-registry.cjs');

const isDev = !app.isPackaged;
let logFilePath = '';
let mainWindow = null;
let initPromise = null;
const initTracker = createInitStatusTracker({
  phase: 'boot',
  message: '啟動中',
  progress: 5,
});

function resolveDatabasePath() {
  const defaultDbPath = path.join(app.getPath('userData'), 'tax-engine-pro-2025.db');
  if (isDev) return defaultDbPath;

  const exeDir = path.dirname(app.getPath('exe'));
  const localDbPath = path.join(exeDir, 'tax-engine-pro-2025.db');
  if (fs.existsSync(localDbPath)) return localDbPath;

  return defaultDbPath;
}

function logLine(message) {
  try {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    if (logFilePath) fs.appendFileSync(logFilePath, line, 'utf8');
    if (isDev) console.log(line.trim());
  } catch {
    // ignore logging failures
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.on('did-finish-load', () => {
    try {
      win.webContents.send('app:init-progress', initTracker.getState());
    } catch {
      // ignore window sync errors
    }
  });

  win.once('ready-to-show', () => logLine('window ready-to-show'));
  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    logLine(`did-fail-load code=${code} desc=${desc} url=${url}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    logLine(`render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
  });

  return win;
}

function publishInitState(state) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send('app:init-progress', state);
  } catch {
    // ignore window sync errors
  }
}

function updateInitState(patch) {
  const state = initTracker.update(patch);
  logLine(`init phase=${state.phase} progress=${state.progress} ready=${state.ready}`);
  publishInitState(state);
  return state;
}

async function initializeAppResources() {
  updateInitState({ phase: 'database', message: '初始化資料庫', progress: 20 });
  const dbPath = resolveDatabasePath();
  initDatabase(app.getPath('userData'), { dbPath });
  logLine(`database initialized: ${dbPath}`);
  updateInitState({ phase: 'database', message: '資料庫初始化完成', progress: 75 });

  updateInitState({ phase: 'warmup', message: '載入模組', progress: 90 });
  initTracker.complete('啟動完成');
  publishInitState(initTracker.getState());
}

function ensureAppReady() {
  if (!initPromise) {
    initPromise = initializeAppResources().catch((error) => {
      initTracker.fail(error);
      publishInitState(initTracker.getState());
      logLine(`init failed: ${error.stack || error.message}`);
      throw error;
    });
  }
  return initPromise;
}

function withReady(handler) {
  return async (...args) => {
    await ensureAppReady();
    return handler(...args);
  };
}

app.whenReady().then(() => {
  const logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  logFilePath = path.join(logDir, `startup-${new Date().toISOString().slice(0, 10)}.log`);
  logLine('app ready');
  mainWindow = createWindow();
  void ensureAppReady();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  logLine('window-all-closed');
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
  logLine(`uncaughtException: ${error.stack || error.message}`);
});

process.on('unhandledRejection', (reason) => {
  logLine(`unhandledRejection: ${String(reason)}`);
});

ipcMain.handle('app:init-status', async () => initTracker.getState());
ipcMain.handle('client:list', withReady(async () => dbApi.listClients()));
ipcMain.handle('client:create', withReady(async (_evt, client) => dbApi.createClient(client)));
ipcMain.handle('calc:run', withReady(async (_evt, payload) => runCalculation(payload)));
ipcMain.handle('calc:save', withReady(async (_evt, record) => dbApi.saveCalculation(record)));
ipcMain.handle('calc:history', withReady(async (_evt, clientId) => dbApi.listHistory(clientId)));
ipcMain.handle('laws:search', withReady(async (_evt, query) => dbApi.searchLaws(query)));
ipcMain.handle('laws:listNames', withReady(async () => dbApi.listLawNames()));
ipcMain.handle('dashboard:stats', withReady(async () => dbApi.getDashboardStats()));
ipcMain.handle('registry:lookup', withReady(async (_evt, taxId) => {
  try {
    const remote = await lookupRegistryByTaxId(taxId);
    dbApi.upsertPublicRegistry(remote);
    return { ok: true, data: remote, cached: false };
  } catch (error) {
    const fallback = dbApi.getPublicRegistryByTaxId(String(taxId || '').replace(/\D/g, ''));
    if (fallback) {
      return { ok: true, data: { ...fallback, source: 'cache' }, cached: true, message: `使用本機快取：${String(error.message || error)}` };
    }
    return { ok: false, message: String(error.message || error) };
  }
}));
ipcMain.handle('registry:getCached', withReady(async (_evt, taxId) => {
  const data = dbApi.getPublicRegistryByTaxId(String(taxId || '').replace(/\D/g, ''));
  return { ok: !!data, data: data || null };
}));
ipcMain.handle('registry:syncClients', withReady(async () => {
  const taxIds = dbApi.getClientTaxIds();
  const result = [];
  for (const taxId of taxIds) {
    try {
      const remote = await lookupRegistryByTaxId(taxId);
      dbApi.upsertPublicRegistry(remote);
      result.push({ taxId, ok: true, source: 'remote' });
    } catch (error) {
      const cached = dbApi.getPublicRegistryByTaxId(taxId);
      result.push({ taxId, ok: !!cached, source: cached ? 'cache' : 'none', message: String(error.message || error) });
    }
  }
  return {
    ok: true,
    total: taxIds.length,
    success: result.filter((r) => r.ok).length,
    failed: result.filter((r) => !r.ok).length,
    details: result,
  };
}));
ipcMain.handle('registry:syncTaxIds', withReady(async (_evt, taxIdsInput) => {
  const taxIds = Array.from(
    new Set(
      (Array.isArray(taxIdsInput) ? taxIdsInput : [])
        .map((x) => String(x || '').replace(/\D/g, ''))
        .filter((x) => /^\d{8}$/.test(x))
    )
  );

  const result = [];
  for (const taxId of taxIds) {
    try {
      const remote = await lookupRegistryByTaxId(taxId);
      dbApi.upsertPublicRegistry(remote);
      result.push({ taxId, ok: true, source: 'remote' });
    } catch (error) {
      const cached = dbApi.getPublicRegistryByTaxId(taxId);
      result.push({ taxId, ok: !!cached, source: cached ? 'cache' : 'none', message: String(error.message || error) });
    }
  }
  return {
    ok: true,
    total: taxIds.length,
    success: result.filter((r) => r.ok).length,
    failed: result.filter((r) => !r.ok).length,
    details: result,
  };
}));

ipcMain.handle('report:pdf', withReady(async (_evt, input) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '匯出 PDF 報表',
    defaultPath: 'tax-report.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportPdfReport(filePath, input);
  return { ok: true, filePath };
}));

ipcMain.handle('report:excel', withReady(async (_evt, input) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '匯出 Excel 報表',
    defaultPath: 'tax-report.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportExcelReport(filePath, input);
  return { ok: true, filePath };
}));

ipcMain.handle('update:verify', withReady(async (_evt, zipPath) => verifyUpdatePackage(zipPath)));
ipcMain.handle('update:apply', withReady(async (_evt, zipPath) => applyUpdatePackage(zipPath, dbApi)));

ipcMain.handle('app:dataPath', withReady(async () => app.getPath('userData')));
ipcMain.handle('app:backup', withReady(async () => {
  const dbPath = dbApi.getDbPath();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(app.getPath('userData'), `backup-${stamp}.db`);
  fs.copyFileSync(dbPath, backupPath);
  return { ok: true, backupPath };
}));

ipcMain.handle('laborForms:downloadOfficial', withReady(async (_evt, formKey) => {
  const outputDir = path.join(app.getPath('downloads'), 'TaxEnginePro2025', 'official-forms');
  const result = await downloadOfficialForm(formKey, outputDir);
  return { ok: true, ...result };
}));

ipcMain.handle('laborForms:getSchemas', withReady(async () => getLaborFormSchemas()));

ipcMain.handle('laborForms:exportMappedWord', withReady(async (_evt, formType, payload) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '匯出官方欄位 1:1 套入版 Word',
    defaultPath: '勞健保-官方欄位對照套入版.docx',
    filters: [{ name: 'Word', extensions: ['docx'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportLaborNhiMappedWord(filePath, formType, payload);
  return { ok: true, filePath };
}));

ipcMain.handle('laborForms:exportDraftWord', withReady(async (_evt, formType, payload) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '匯出可編輯草稿 Word',
    defaultPath: '勞健保-可編輯草稿版.docx',
    filters: [{ name: 'Word', extensions: ['docx'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportLaborNhiDraftWord(filePath, formType, payload);
  return { ok: true, filePath };
}));

ipcMain.handle('laborForms:exportPdf', withReady(async (_evt, formType, payload) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '列印用勞健保草稿 PDF',
    defaultPath: '勞健保申報草稿.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportLaborNhiPdf(filePath, formType, payload);
  return { ok: true, filePath };
}));

ipcMain.handle('laborForms:exportOverlayPdf', withReady(async (_evt, formType, payload) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '匯出官方 PDF 座標套印版',
    defaultPath: '勞健保-官方套印版.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportLaborNhiOverlayPdf(filePath, formType, payload);
  return { ok: true, filePath };
}));
