const path = require('path');
const cheerio = require('cheerio');
const Database = require('better-sqlite3');

const LAW_CODES = [
  { pcode: 'G0340003', alias: '所得稅法' },
  { pcode: 'G0340004', alias: '所得稅法施行細則' },
  { pcode: 'G0340051', alias: '營利事業所得稅查核準則' },
  { pcode: 'G0340080', alias: '加值型及非加值型營業稅法' },
  { pcode: 'G0340081', alias: '加值型及非加值型營業稅法施行細則' },
  { pcode: 'G0340082', alias: '統一發票使用辦法' },
  { pcode: 'G0340028', alias: '各類所得扣繳率標準' },
  { pcode: 'G0340001', alias: '稅捐稽徵法' },
  { pcode: 'G0340039', alias: '稅捐稽徵法施行細則' },
  { pcode: 'G0340115', alias: '所得基本稅額條例' },
  { pcode: 'G0340116', alias: '所得基本稅額條例施行細則' },
  { pcode: 'G0340125', alias: '適用所得稅協定查核準則' },
  { pcode: 'G0340160', alias: '產業創新條例緩課所得稅適用辦法' },
  { pcode: 'G0340161', alias: '所得基本稅額條例第十二條高風險新創事業公司認定辦法' },
  { pcode: 'G0340167', alias: '適用生技醫藥產業發展條例緩課所得稅辦法' },
  { pcode: 'N0050001', alias: '勞工保險條例' },
  { pcode: 'N0050002', alias: '勞工保險條例施行細則' },
  { pcode: 'L0060001', alias: '全民健康保險法' },
  { pcode: 'L0060002', alias: '全民健康保險法施行細則' },
  { pcode: 'N0030020', alias: '勞工退休金條例' },
  { pcode: 'N0030021', alias: '勞工退休金條例施行細則' },
];

function parseArgs() {
  const dbArg = process.argv.find((a) => a.startsWith('--db='));
  if (dbArg) return dbArg.replace('--db=', '');
  return path.join(process.env.APPDATA || '', 'desktop-tax-engine-pro-2025', 'tax-engine-pro-2025.db');
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').replace(/[\u00A0]/g, ' ').trim();
}

function extractArticleNumber(label) {
  const normalized = normalizeText(label);
  const match = normalized.match(/^第\s*(.+?)\s*條$/);
  return match ? match[1] : normalized;
}

async function fetchLawRows(pcode, alias) {
  const url = `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${pcode}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'TaxEnginePro2025/1.0',
    },
  });
  if (!res.ok) {
    throw new Error(`下載失敗 ${pcode}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const titleText = normalizeText($('title').text());
  const lawName = titleText.includes('-') ? titleText.split('-')[0].trim() : alias;

  const rows = [];
  $('div.row').each((_idx, el) => {
    const a = $(el).find('div.col-no a').first();
    const articleLabel = normalizeText(a.text());
    if (!articleLabel.startsWith('第')) return;

    const articleNumber = extractArticleNumber(articleLabel);
    const lines = $(el)
      .find('div.col-data div.law-article > div')
      .map((_i, d) => normalizeText($(d).text()))
      .get()
      .filter(Boolean);

    let content = lines.join('\n');
    if (!content) {
      content = normalizeText($(el).find('div.col-data div.law-article').text());
    }
    if (!content) return;

    rows.push({
      lawName,
      articleNumber,
      title: articleLabel,
      content,
      tags: `${lawName},${alias}`,
      effectiveDate: null,
    });
  });

  return { lawName, rows };
}

function ensureSchema(db) {
  db.exec(`
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
  `);
}

async function main() {
  const dbPath = parseArgs();
  const db = new Database(dbPath);
  ensureSchema(db);

  const upsert = db.prepare(`
    INSERT INTO laws (law_name, article_number, title, content, tags, effective_date)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(law_name, article_number)
    DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      tags = excluded.tags,
      effective_date = excluded.effective_date
  `);

  let imported = 0;

  for (const item of LAW_CODES) {
    const { lawName, rows } = await fetchLawRows(item.pcode, item.alias);
    const tx = db.transaction((items) => {
      for (const row of items) {
        upsert.run(row.lawName, row.articleNumber, row.title, row.content, row.tags, row.effectiveDate);
      }
    });
    tx(rows);
    imported += rows.length;
    console.log(`[OK] ${lawName} (${item.pcode}) 匯入 ${rows.length} 條`);
  }

  const total = db.prepare('SELECT COUNT(*) AS c FROM laws').get().c;
  console.log(`\n完成。此次匯入/更新 ${imported} 條，資料庫目前共 ${total} 條。`);
  console.log(`DB: ${dbPath}`);
  db.close();
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
