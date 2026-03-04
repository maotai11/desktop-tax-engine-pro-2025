const path = require('path');
const { lookupRegistryByTaxId } = require('../electron/public-registry.cjs');
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

  const dbPath = path.resolve(get('--db') || defaultDbPath);
  const idsRaw = get('--tax-ids');
  const delayMs = Number(get('--delay-ms') || 250);

  const taxIds = idsRaw
    ? Array.from(
        new Set(
          idsRaw
            .split(/[\s,;\n\r\t]+/)
            .map((x) => String(x || '').replace(/\D/g, ''))
            .filter((x) => /^\d{8}$/.test(x))
        )
      )
    : [];

  return { dbPath, taxIds, idsProvided: Boolean(idsRaw), delayMs };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { dbPath, taxIds: inputTaxIds, idsProvided, delayMs } = parseArgs();
  const userDataPath = path.dirname(dbPath);
  initDatabase(userDataPath, { dbPath });

  const activeDbPath = path.resolve(dbApi.getDbPath());
  if (activeDbPath !== dbPath) {
    console.warn(`[WARN] --db 指向 ${dbPath}，實際使用 ${activeDbPath}`);
  }

  if (idsProvided && inputTaxIds.length === 0) {
    console.error('[ERROR] --tax-ids 已提供，但沒有任何有效 8 碼統編');
    process.exit(1);
  }

  const taxIds = idsProvided
    ? inputTaxIds
    : Array.from(new Set(dbApi.getClientTaxIds()));

  if (taxIds.length === 0) {
    console.log('[INFO] 無可同步統編；請先建立 clients 或使用 --tax-ids');
    return;
  }

  console.log(`[INFO] DB: ${activeDbPath}`);
  console.log(`[INFO] 待同步統編數: ${taxIds.length}`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < taxIds.length; i += 1) {
    const taxId = taxIds[i];
    try {
      const remote = await lookupRegistryByTaxId(taxId);
      dbApi.upsertPublicRegistry(remote);
      success += 1;
      console.log(`[OK] (${i + 1}/${taxIds.length}) ${taxId} ${remote.entityName || ''}`.trim());
    } catch (error) {
      failed += 1;
      console.error(`[FAIL] (${i + 1}/${taxIds.length}) ${taxId} ${String(error.message || error)}`);
    }
    if (delayMs > 0 && i < taxIds.length - 1) await sleep(delayMs);
  }

  const stats = dbApi.getDashboardStats();

  console.log(`\n完成。成功 ${success} 筆，失敗 ${failed} 筆。`);
  console.log(`快取筆數: public_registry_cache=${stats.registryCache}`);
}

main().catch((error) => {
  console.error('[ERROR]', String(error.message || error));
  process.exit(1);
});
