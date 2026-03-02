const path = require('path');
const Database = require('better-sqlite3');

let db;
let dbPath;

function initDatabase(userDataPath) {
  dbPath = path.join(userDataPath, 'tax-engine-pro-2025.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tax_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'business',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS calculation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      module_type TEXT NOT NULL,
      year INTEGER NOT NULL,
      payload TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS laws (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      law_name TEXT NOT NULL,
      article_number TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      effective_date TEXT,
      UNIQUE(law_name, article_number)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS laws_fts USING fts5(
      law_name, article_number, title, content, content='laws', content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS laws_ai AFTER INSERT ON laws BEGIN
      INSERT INTO laws_fts(rowid, law_name, article_number, title, content)
      VALUES (new.id, new.law_name, new.article_number, new.title, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS laws_au AFTER UPDATE ON laws BEGIN
      UPDATE laws_fts
      SET law_name = new.law_name,
          article_number = new.article_number,
          title = new.title,
          content = new.content
      WHERE rowid = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS laws_ad AFTER DELETE ON laws BEGIN
      DELETE FROM laws_fts WHERE rowid = old.id;
    END;

    CREATE TABLE IF NOT EXISTS tax_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_type TEXT NOT NULL,
      year INTEGER NOT NULL,
      rate_data TEXT NOT NULL,
      effective_date TEXT,
      UNIQUE(module_type, year)
    );

    CREATE TABLE IF NOT EXISTS update_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL,
      detail TEXT
    );

    CREATE TABLE IF NOT EXISTS public_registry_cache (
      tax_id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL, -- company | business
      entity_name TEXT NOT NULL,
      status_desc TEXT,
      responsible_name TEXT,
      address TEXT,
      authority_desc TEXT,
      setup_date TEXT,
      latest_change_date TEXT,
      raw_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS public_registry_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tax_id TEXT NOT NULL,
      seq_no TEXT,
      item_code TEXT,
      item_desc TEXT,
      FOREIGN KEY (tax_id) REFERENCES public_registry_cache(tax_id)
    );

    CREATE INDEX IF NOT EXISTS idx_public_registry_items_tax_id ON public_registry_items(tax_id);
  `);

  seedData();
}

function seedData() {
  const clientCount = db.prepare('SELECT COUNT(*) AS c FROM clients').get().c;
  if (clientCount === 0) {
    db.prepare('INSERT INTO clients (tax_id, name, type) VALUES (?, ?, ?)').run('24536801', '展碁科技股份有限公司', 'business');
    db.prepare('INSERT INTO clients (tax_id, name, type) VALUES (?, ?, ?)').run('97162640', '瑞昱半導體股份有限公司', 'business');
  }

  const lawCount = db.prepare('SELECT COUNT(*) AS c FROM laws').get().c;
  if (lawCount === 0) {
    const laws = [
      ['所得稅法', '24', '營利事業所得額計算', '營利事業所得之計算，以其本年度收入總額減除成本、費用、損失及稅捐後之純益額為所得額。', '營所稅,所得額'],
      ['所得稅法', '37', '交際費限額', '交際費得按營業收入淨額及進貨淨額一定比率列支，超限部分不得認列。', '交際費,損益'],
      ['加值型及非加值型營業稅法', '15', '應納或溢付稅額', '當期銷項稅額扣減進項稅額後之餘額，為當期應納或溢付營業稅額。', '營業稅,銷項,進項'],
      ['所得稅法', '71', '綜合所得稅結算申報', '納稅義務人應於規定期限內辦理綜合所得稅結算申報。', '綜所稅,申報'],
      ['所得稅法', '88', '扣繳義務', '扣繳義務人於給付所得時，應依規定扣繳稅款。', '扣繳,憑單']
    ];
    const stmt = db.prepare('INSERT INTO laws (law_name, article_number, title, content, tags, effective_date) VALUES (?, ?, ?, ?, ?, ?)');
    const tx = db.transaction(() => {
      for (const law of laws) {
        stmt.run(...law, '2025-01-01');
      }
    });
    tx();
  }

  const rateCount = db.prepare('SELECT COUNT(*) AS c FROM tax_rates').get().c;
  if (rateCount === 0) {
    const stmt = db.prepare('INSERT INTO tax_rates (module_type, year, rate_data, effective_date) VALUES (?, ?, ?, ?)');
    stmt.run('corp_income', 2025, JSON.stringify({ flatRate: 0.2 }), '2025-01-01');
    stmt.run('vat', 2025, JSON.stringify({ outputRate: 0.05 }), '2025-01-01');
    stmt.run('withholding', 2025, JSON.stringify({ serviceRate: 0.1 }), '2025-01-01');
    stmt.run('labor_nhi', 2025, JSON.stringify({ laborEmployerRate: 0.07, nhiEmployerRate: 0.0517, pensionRate: 0.06 }), '2025-01-01');
  }
}

const dbApi = {
  getDbPath: () => dbPath,
  listClients: () => db.prepare('SELECT * FROM clients ORDER BY id').all(),
  createClient: (client) => {
    const info = db.prepare('INSERT INTO clients (tax_id, name, type) VALUES (?, ?, ?)').run(client.taxId, client.name, client.type || 'business');
    return db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
  },
  saveCalculation: (record) => {
    const info = db
      .prepare('INSERT INTO calculation_history (client_id, module_type, year, payload, result) VALUES (?, ?, ?, ?, ?)')
      .run(record.clientId || null, record.moduleType, record.year, JSON.stringify(record.payload), JSON.stringify(record.result));
    return { id: info.lastInsertRowid };
  },
  listHistory: (clientId) => {
    if (clientId) {
      return db.prepare('SELECT * FROM calculation_history WHERE client_id = ? ORDER BY id DESC LIMIT 100').all(clientId);
    }
    return db.prepare('SELECT * FROM calculation_history ORDER BY id DESC LIMIT 100').all();
  },
  listLawNames: () => db.prepare('SELECT DISTINCT law_name FROM laws ORDER BY law_name').all().map((r) => r.law_name),
  searchLaws: (query) => {
    const keyword = String(
      typeof query === 'string'
        ? query
        : query && typeof query === 'object' && 'keyword' in query
          ? query.keyword || ''
          : ''
    ).trim();
    const lawName = String(
      query && typeof query === 'object' && 'lawName' in query
        ? query.lawName || ''
        : ''
    ).trim();

    const likeKeyword = `%${keyword}%`;
    return db
      .prepare(
        `SELECT l.id, l.law_name, l.article_number, l.title, l.content
         FROM laws l
         WHERE (? = '' OR l.law_name = ?)
           AND (
             ? = ''
             OR l.law_name LIKE ?
             OR l.article_number LIKE ?
             OR l.title LIKE ?
             OR l.content LIKE ?
             OR IFNULL(l.tags, '') LIKE ?
           )
         ORDER BY l.law_name, CAST(l.article_number AS INTEGER), l.article_number
         LIMIT 300`
      )
      .all(
        lawName,
        lawName,
        keyword,
        likeKeyword,
        likeKeyword,
        likeKeyword,
        likeKeyword,
        likeKeyword
      );
  },
  getDashboardStats: () => {
    const clients = db.prepare('SELECT COUNT(*) AS c FROM clients').get().c;
    const history = db.prepare('SELECT COUNT(*) AS c FROM calculation_history').get().c;
    const laws = db.prepare('SELECT COUNT(*) AS c FROM laws').get().c;
    const registryCache = db.prepare('SELECT COUNT(*) AS c FROM public_registry_cache').get().c;
    return { clients, history, laws, registryCache };
  },
  upsertTaxRate: (moduleType, year, rateData, effectiveDate) => {
    db.prepare(
      `INSERT INTO tax_rates (module_type, year, rate_data, effective_date)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(module_type, year)
       DO UPDATE SET rate_data = excluded.rate_data, effective_date = excluded.effective_date`
    ).run(moduleType, year, JSON.stringify(rateData), effectiveDate);
  },
  upsertLaw: (law) => {
    db.prepare(
      `INSERT INTO laws (law_name, article_number, title, content, tags, effective_date)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(law_name, article_number)
       DO UPDATE SET title = excluded.title, content = excluded.content, tags = excluded.tags, effective_date = excluded.effective_date`
    ).run(law.lawName, law.articleNumber, law.title, law.content, law.tags || '', law.effectiveDate || null);
  },
  addUpdateAudit: (packageId, status, detail) => {
    db.prepare('INSERT INTO update_audit (package_id, status, detail) VALUES (?, ?, ?)').run(packageId, status, detail);
  },
  getClientTaxIds: () => db.prepare('SELECT tax_id FROM clients ORDER BY id').all().map((r) => r.tax_id),
  upsertPublicRegistry: (record) => {
    db.prepare(
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
    ).run(
      record.taxId,
      record.entityType,
      record.entityName,
      record.statusDesc || null,
      record.responsibleName || null,
      record.address || null,
      record.authorityDesc || null,
      record.setupDate || null,
      record.latestChangeDate || null,
      JSON.stringify(record.raw || {})
    );

    db.prepare('DELETE FROM public_registry_items WHERE tax_id = ?').run(record.taxId);
    if (Array.isArray(record.businessItems) && record.businessItems.length > 0) {
      const stmt = db.prepare('INSERT INTO public_registry_items (tax_id, seq_no, item_code, item_desc) VALUES (?, ?, ?, ?)');
      const tx = db.transaction((items) => {
        for (const item of items) {
          stmt.run(record.taxId, item.seqNo || null, item.itemCode || null, item.itemDesc || null);
        }
      });
      tx(record.businessItems);
    }
  },
  getPublicRegistryByTaxId: (taxId) => {
    const profile = db.prepare('SELECT * FROM public_registry_cache WHERE tax_id = ?').get(taxId);
    if (!profile) return null;
    const items = db.prepare('SELECT seq_no, item_code, item_desc FROM public_registry_items WHERE tax_id = ? ORDER BY id').all(taxId);
    return { ...profile, business_items: items };
  },
};

module.exports = { initDatabase, dbApi };
