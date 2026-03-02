const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, dbApi } = require('./db.cjs');
const { runCalculation } = require('./calculators.cjs');
const { exportPdfReport, exportExcelReport } = require('./export.cjs');
const { verifyUpdatePackage, applyUpdatePackage } = require('./update-package.cjs');
const { getLaborFormSchemas, downloadOfficialForm, exportLaborNhiMappedWord, exportLaborNhiDraftWord, exportLaborNhiPdf, exportLaborNhiOverlayPdf } = require('./labor-forms.cjs');
const { lookupRegistryByTaxId } = require('./public-registry.cjs');

const isDev = !app.isPackaged;
let logFilePath = '';

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
      sandbox: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.once('ready-to-show', () => logLine('window ready-to-show'));
  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    logLine(`did-fail-load code=${code} desc=${desc} url=${url}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    logLine(`render-process-gone reason=${details.reason} exitCode=${details.exitCode}`);
  });
}

app.whenReady().then(() => {
  const logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  logFilePath = path.join(logDir, `startup-${new Date().toISOString().slice(0, 10)}.log`);
  logLine('app ready');
  initDatabase(app.getPath('userData'));
  logLine('database initialized');
  createWindow();

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

ipcMain.handle('client:list', async () => dbApi.listClients());
ipcMain.handle('client:create', async (_evt, client) => dbApi.createClient(client));
ipcMain.handle('calc:run', async (_evt, payload) => runCalculation(payload));
ipcMain.handle('calc:save', async (_evt, record) => dbApi.saveCalculation(record));
ipcMain.handle('calc:history', async (_evt, clientId) => dbApi.listHistory(clientId));
ipcMain.handle('laws:search', async (_evt, query) => dbApi.searchLaws(query));
ipcMain.handle('laws:listNames', async () => dbApi.listLawNames());
ipcMain.handle('dashboard:stats', async () => dbApi.getDashboardStats());
ipcMain.handle('registry:lookup', async (_evt, taxId) => {
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
});
ipcMain.handle('registry:getCached', async (_evt, taxId) => {
  const data = dbApi.getPublicRegistryByTaxId(String(taxId || '').replace(/\D/g, ''));
  return { ok: !!data, data: data || null };
});
ipcMain.handle('registry:syncClients', async () => {
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
});
ipcMain.handle('registry:syncTaxIds', async (_evt, taxIdsInput) => {
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
});

ipcMain.handle('report:pdf', async (_evt, input) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '匯出 PDF 報表',
    defaultPath: 'tax-report.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportPdfReport(filePath, input);
  return { ok: true, filePath };
});

ipcMain.handle('report:excel', async (_evt, input) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '匯出 Excel 報表',
    defaultPath: 'tax-report.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportExcelReport(filePath, input);
  return { ok: true, filePath };
});

ipcMain.handle('update:verify', async (_evt, zipPath) => verifyUpdatePackage(zipPath));
ipcMain.handle('update:apply', async (_evt, zipPath) => applyUpdatePackage(zipPath, dbApi));

ipcMain.handle('app:dataPath', async () => app.getPath('userData'));
ipcMain.handle('app:backup', async () => {
  const dbPath = dbApi.getDbPath();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(app.getPath('userData'), `backup-${stamp}.db`);
  fs.copyFileSync(dbPath, backupPath);
  return { ok: true, backupPath };
});

ipcMain.handle('laborForms:downloadOfficial', async (_evt, formKey) => {
  const outputDir = path.join(app.getPath('downloads'), 'TaxEnginePro2025', 'official-forms');
  const result = await downloadOfficialForm(formKey, outputDir);
  return { ok: true, ...result };
});

ipcMain.handle('laborForms:getSchemas', async () => getLaborFormSchemas());

ipcMain.handle('laborForms:exportMappedWord', async (_evt, formType, payload) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '匯出官方欄位 1:1 套入版 Word',
    defaultPath: '勞健保-官方欄位對照套入版.docx',
    filters: [{ name: 'Word', extensions: ['docx'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportLaborNhiMappedWord(filePath, formType, payload);
  return { ok: true, filePath };
});

ipcMain.handle('laborForms:exportDraftWord', async (_evt, formType, payload) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '匯出可編輯草稿 Word',
    defaultPath: '勞健保-可編輯草稿版.docx',
    filters: [{ name: 'Word', extensions: ['docx'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportLaborNhiDraftWord(filePath, formType, payload);
  return { ok: true, filePath };
});

ipcMain.handle('laborForms:exportPdf', async (_evt, formType, payload) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '列印用勞健保草稿 PDF',
    defaultPath: '勞健保申報草稿.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportLaborNhiPdf(filePath, formType, payload);
  return { ok: true, filePath };
});

ipcMain.handle('laborForms:exportOverlayPdf', async (_evt, formType, payload) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '匯出官方 PDF 座標套印版',
    defaultPath: '勞健保-官方套印版.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false, message: '已取消' };
  await exportLaborNhiOverlayPdf(filePath, formType, payload);
  return { ok: true, filePath };
});
