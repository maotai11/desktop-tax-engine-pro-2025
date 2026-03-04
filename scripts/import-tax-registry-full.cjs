const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');
const { execFileSync } = require('child_process');
const { initDatabase, dbApi } = require('../electron/db.cjs');

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key) => {
    const hit = args.find((a) => a.startsWith(`${key}=`));
    return hit ? hit.slice(key.length + 1) : '';
  };

  const defaultDbPath = path.join(
    process.env.APPDATA || '',
    'desktop-tax-engine-pro-2025',
    'tax-engine-pro-2025.db'
  );

  return {
    dbPath: path.resolve(get('--db') || defaultDbPath),
    csvPath: get('--csv') ? path.resolve(get('--csv')) : '',
    zipPath: get('--zip') ? path.resolve(get('--zip')) : '',
    keepExisting: get('--keep-existing') === '1',
  };
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let i = 0;
  let inQuote = false;

  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      inQuote = !inQuote;
      i += 1;
      continue;
    }
    if (ch === ',' && !inQuote) {
      out.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  out.push(cur);
  return out;
}

function normalizeTaxId(v) {
  const x = String(v || '').replace(/\D/g, '');
  return /^\d{8}$/.test(x) ? x : '';
}

function formatRocDate(raw) {
  const s = String(raw || '').trim();
  if (!/^\d{7}$/.test(s)) return null;
  const y = Number(s.slice(0, 3)) + 1911;
  const m = s.slice(3, 5);
  const d = s.slice(5, 7);
  return `${y}-${m}-${d}`;
}

function ensureCsvFromZip(zipPath) {
  if (!zipPath) return '';
  if (!fs.existsSync(zipPath)) throw new Error(`找不到 ZIP: ${zipPath}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tax-registry-'));
  execFileSync('tar', ['-xf', zipPath, '-C', tmpDir], { stdio: 'inherit' });
  const csvPath = path.join(tmpDir, 'BGMOPEN1.csv');
  if (!fs.existsSync(csvPath)) throw new Error(`ZIP 內找不到 BGMOPEN1.csv: ${zipPath}`);
  return csvPath;
}

async function main() {
  const { dbPath, csvPath: csvPathArg, zipPath, keepExisting } = parseArgs();
  const csvPath = csvPathArg || ensureCsvFromZip(zipPath);
  if (!csvPath || !fs.existsSync(csvPath)) {
    throw new Error('請提供 --csv 或 --zip');
  }

  initDatabase(path.dirname(dbPath), { dbPath });
  const activeDbPath = path.resolve(dbApi.getDbPath());

  const Database = require('better-sqlite3');
  const db = new Database(activeDbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  if (!keepExisting) {
    db.exec('DELETE FROM public_registry_items; DELETE FROM public_registry_cache;');
  }

  const upsert = db.prepare(
    `INSERT INTO public_registry_cache
      (tax_id, entity_type, entity_name, status_desc, responsible_name, address, authority_desc, setup_date, latest_change_date, raw_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(tax_id)
      DO UPDATE SET
        entity_type = excluded.entity_type,
        entity_name = excluded.entity_name,
        status_desc = excluded.status_desc,
        responsible_name = excluded.responsible_name,
        address = excluded.address,
        authority_desc = excluded.authority_desc,
        setup_date = excluded.setup_date,
        latest_change_date = excluded.latest_change_date,
        raw_json = excluded.raw_json,
        updated_at = CURRENT_TIMESTAMP`
  );

  const insertBatch = db.transaction((rows) => {
    for (const r of rows) {
      upsert.run(
        r.taxId,
        'tax_registry',
        r.entityName,
        r.statusDesc,
        null,
        r.address,
        r.authorityDesc,
        r.setupDate,
        null,
        r.rawJson
      );
    }
  });

  const stream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lineNo = 0;
  let header = [];
  let batch = [];
  let total = 0;
  let imported = 0;
  let skipped = 0;

  for await (const line of rl) {
    lineNo += 1;
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (lineNo === 1) {
      header = cols;
      continue;
    }
    if (lineNo === 2 && /^\d{2}-[A-Z]{3}-\d{2}$/.test(String(cols[0] || '').trim())) {
      continue;
    }

    total += 1;
    const rec = {};
    for (let i = 0; i < header.length; i += 1) rec[header[i]] = cols[i] || '';

    const taxId = normalizeTaxId(rec['統一編號']);
    if (!taxId) {
      skipped += 1;
      continue;
    }

    batch.push({
      taxId,
      entityName: String(rec['營業人名稱'] || '').trim() || '(未提供名稱)',
      address: String(rec['營業地址'] || '').trim(),
      authorityDesc: String(rec['組織別名稱'] || '').trim(),
      statusDesc: '營業中',
      setupDate: formatRocDate(rec['設立日期']),
      rawJson: JSON.stringify({
        branchTaxId: String(rec['總機構統一編號'] || '').trim(),
        capital: String(rec['資本額'] || '').trim(),
        useInvoice: String(rec['使用統一發票'] || '').trim(),
        industryCode: String(rec['行業代號'] || '').trim(),
        industryName: String(rec['名稱'] || '').trim(),
        industryCode1: String(rec['行業代號1'] || '').trim(),
        industryName1: String(rec['名稱1'] || '').trim(),
        industryCode2: String(rec['行業代號2'] || '').trim(),
        industryName2: String(rec['名稱2'] || '').trim(),
        industryCode3: String(rec['行業代號3'] || '').trim(),
        industryName3: String(rec['名稱3'] || '').trim(),
      }),
    });

    if (batch.length >= 5000) {
      insertBatch(batch);
      imported += batch.length;
      batch = [];
      if (imported % 50000 === 0) console.log(`[INFO] 已匯入 ${imported} 筆...`);
    }
  }

  if (batch.length > 0) {
    insertBatch(batch);
    imported += batch.length;
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_public_registry_cache_entity_name ON public_registry_cache(entity_name);');

  const count = db.prepare('SELECT COUNT(*) AS c FROM public_registry_cache').get().c;
  db.close();

  console.log(`[DONE] 處理資料行: ${total}, 匯入/更新: ${imported}, 跳過: ${skipped}`);
  console.log(`[DONE] public_registry_cache 目前筆數: ${count}`);
  console.log(`[DONE] DB: ${activeDbPath}`);
}

main().catch((err) => {
  console.error('[ERROR]', String(err.message || err));
  process.exit(1);
});
