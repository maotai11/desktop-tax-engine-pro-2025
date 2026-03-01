const fs = require('fs');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType } = require('docx');
const { PDFDocument: PdfLibDocument, StandardFonts, rgb } = require('pdf-lib');

const OFFICIAL_FORMS = {
  laborNhiCombined_doc: {
    label: '勞、就、職、健保暨勞退合一表格(WORD)',
    url: 'https://www.bli.gov.tw/media/3v4bf0x2/1-2%E5%8B%9E%E3%80%81%E5%B0%B1%E3%80%81%E8%81%B7%E3%80%81%E5%81%A5%E4%BF%9D%E6%9A%A8%E5%8B%9E%E9%80%80%E5%90%88%E4%B8%80%E8%A1%A8%E6%A0%BC.doc',
    ext: 'doc',
  },
  laborNhiCombined_pdf: {
    label: '勞、就、職、健保暨勞退合一表格(PDF)',
    url: 'https://www.bli.gov.tw/media/g5wha4yc/1-2%E5%8B%9E%E3%80%81%E5%B0%B1%E3%80%81%E8%81%B7%E3%80%81%E5%81%A5%E4%BF%9D%E6%9A%A8%E5%8B%9E%E9%80%80%E5%90%88%E4%B8%80%E8%A1%A8%E6%A0%BC.pdf',
    ext: 'pdf',
  },
  nhiOnlyAdd_doc: {
    label: '全民健康保險保險對象投保申報表(加保)(WORD)',
    url: 'https://www.bli.gov.tw/media/d0ad5czw/2-7%E5%85%A8%E6%B0%91%E5%81%A5%E5%BA%B7%E4%BF%9D%E9%9A%AA%E4%BF%9D%E9%9A%AA%E5%B0%8D%E8%B1%A1%E6%8A%95%E4%BF%9D%E7%94%B3%E5%A0%B1%E8%A1%A8%E5%8A%A0%E4%BF%9D.docx',
    ext: 'docx',
  },
  nhiOnlyWithdraw_doc: {
    label: '全民健康保險保險對象退保申報表(退保)(WORD)',
    url: 'https://www.bli.gov.tw/media/l2xog2ag/2-8%E5%85%A8%E6%B0%91%E5%81%A5%E5%BA%B7%E4%BF%9D%E9%9A%AA%E4%BF%9D%E9%9A%AA%E5%B0%8D%E8%B1%A1%E9%80%80%E4%BF%9D%E7%94%B3%E5%A0%B1%E8%A1%A8%E9%80%80%E4%BF%9D.docx',
    ext: 'docx',
  },
};

const FORM_SCHEMAS = {
  labor_nhi_combined: {
    label: '勞健保合一加退保',
    officialDownloadKeys: ['laborNhiCombined_doc', 'laborNhiCombined_pdf'],
    fields: [
      { key: 'unitName', label: '投保單位名稱' },
      { key: 'unitInsuranceNo', label: '單位保險證號' },
      { key: 'unitTaxId', label: '統一編號' },
      { key: 'contactName', label: '承辦人' },
      { key: 'contactPhone', label: '聯絡電話' },
      { key: 'personName', label: '被保險人姓名' },
      { key: 'personId', label: '身分證字號' },
      { key: 'birthDate', label: '出生日期' },
      { key: 'applyDate', label: '申報日期' },
      { key: 'insuranceStartDate', label: '加保生效日' },
      { key: 'insuranceEndDate', label: '退保生效日' },
      { key: 'salaryGrade', label: '投保薪資' },
      { key: 'pensionRate', label: '勞退提繳率(%)' },
      { key: 'actionType', label: '作業類型(加保/退保/調整)' },
      { key: 'note', label: '備註' },
    ],
  },
  nhi_only_add: {
    label: '健保單獨加保',
    officialDownloadKeys: ['nhiOnlyAdd_doc'],
    fields: [
      { key: 'unitName', label: '投保單位名稱' },
      { key: 'unitInsuranceNo', label: '單位保險證號' },
      { key: 'unitTaxId', label: '統一編號' },
      { key: 'contactName', label: '承辦人' },
      { key: 'contactPhone', label: '聯絡電話' },
      { key: 'personName', label: '被保險人姓名' },
      { key: 'personId', label: '身分證字號' },
      { key: 'birthDate', label: '出生日期' },
      { key: 'insuredCategory', label: '被保險人身分類別' },
      { key: 'dependentsCount', label: '眷屬人數' },
      { key: 'applyDate', label: '加保日期' },
      { key: 'salaryGrade', label: '投保金額' },
      { key: 'note', label: '備註' },
    ],
  },
  nhi_only_withdraw: {
    label: '健保單獨退保',
    officialDownloadKeys: ['nhiOnlyWithdraw_doc'],
    fields: [
      { key: 'unitName', label: '投保單位名稱' },
      { key: 'unitInsuranceNo', label: '單位保險證號' },
      { key: 'unitTaxId', label: '統一編號' },
      { key: 'contactName', label: '承辦人' },
      { key: 'contactPhone', label: '聯絡電話' },
      { key: 'personName', label: '被保險人姓名' },
      { key: 'personId', label: '身分證字號' },
      { key: 'birthDate', label: '出生日期' },
      { key: 'withdrawDate', label: '退保日期' },
      { key: 'withdrawReason', label: '退保原因' },
      { key: 'note', label: '備註' },
    ],
  },
};

// 座標會因官方模板改版而需要微調。
const PDF_OVERLAY_CONFIG = {
  labor_nhi_combined: {
    templateKey: 'laborNhiCombined_pdf',
    page: 0,
    defaultFontSize: 10,
    fields: {
      unitName: { x: 95, y: 715, max: 28 },
      unitInsuranceNo: { x: 95, y: 690, max: 16 },
      unitTaxId: { x: 280, y: 690, max: 12 },
      contactName: { x: 95, y: 665, max: 14 },
      contactPhone: { x: 280, y: 665, max: 16 },
      personName: { x: 95, y: 585, max: 20 },
      personId: { x: 280, y: 585, max: 12 },
      birthDate: { x: 420, y: 585, max: 12 },
      applyDate: { x: 95, y: 560, max: 12 },
      insuranceStartDate: { x: 220, y: 560, max: 12 },
      insuranceEndDate: { x: 345, y: 560, max: 12 },
      salaryGrade: { x: 95, y: 535, max: 16 },
      pensionRate: { x: 280, y: 535, max: 8 },
      actionType: { x: 420, y: 535, max: 16 },
      note: { x: 95, y: 500, max: 50 },
    },
  },
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function truncateValue(value, maxLen = 50) {
  const text = String(value || '').replace(/\r?\n/g, ' ');
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(1, maxLen - 1))}…`;
}

function getLaborFormSchemas() {
  return FORM_SCHEMAS;
}

function getSchemaOrThrow(formType) {
  const schema = FORM_SCHEMAS[formType];
  if (!schema) throw new Error(`未知表單類型: ${formType}`);
  return schema;
}

function mapRowsBySchema(formType, payload) {
  const schema = getSchemaOrThrow(formType);
  return schema.fields.map((f) => [f.label, (payload && payload[f.key]) || '']);
}

async function fetchOfficialFormBuffer(formKey) {
  const cfg = OFFICIAL_FORMS[formKey];
  if (!cfg) throw new Error(`未知表單代碼: ${formKey}`);

  const response = await axios.get(cfg.url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  return Buffer.from(response.data);
}

async function downloadOfficialForm(key, outputDir) {
  const cfg = OFFICIAL_FORMS[key];
  if (!cfg) throw new Error(`未知表單代碼: ${key}`);

  ensureDir(outputDir);
  const fileName = `${cfg.label.replace(/[\\/:*?"<>|]/g, '_')}.${cfg.ext}`;
  const outPath = path.join(outputDir, fileName);
  const buffer = await fetchOfficialFormBuffer(key);
  fs.writeFileSync(outPath, buffer);
  return { filePath: outPath, label: cfg.label, sourceUrl: cfg.url };
}

async function exportLaborNhiMappedWord(outputPath, formType, payload) {
  const schema = getSchemaOrThrow(formType);
  const rows = mapRowsBySchema(formType, payload);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: `${schema.label} - 官方欄位 1:1 對照套入版`, bold: true, size: 30 })],
          }),
          new Paragraph({ text: '說明：此文件依官方欄位順序自動套入，供送件前快速核對。' }),
          new Paragraph({ text: `生成時間：${new Date().toLocaleString('zh-TW')}` }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: '官方欄位' })] }),
                  new TableCell({ children: [new Paragraph({ text: '套入值' })] }),
                ],
              }),
              ...rows.map(
                ([k, v]) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: k })] }),
                      new TableCell({ children: [new Paragraph({ text: String(v) })] }),
                    ],
                  })
              ),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  return { filePath: outputPath };
}

async function exportLaborNhiDraftWord(outputPath, formType, payload) {
  const schema = getSchemaOrThrow(formType);
  const rows = mapRowsBySchema(formType, payload);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: `${schema.label} - 可編輯草稿版`, bold: true, size: 30 })],
          }),
          new Paragraph({ text: '用途：節省手動編輯時間，可直接在 Word 再微調。' }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rows.map(
              ([k, v]) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: k })] }),
                    new TableCell({ children: [new Paragraph({ text: String(v) })] }),
                  ],
                })
            ),
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  return { filePath: outputPath };
}

async function exportLaborNhiPdf(outputPath, formType, payload) {
  const schema = getSchemaOrThrow(formType);
  const rows = mapRowsBySchema(formType, payload);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(18).text(`${schema.label} - 列印草稿`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(11);
    for (const [k, v] of rows) {
      doc.text(`${k}：${v || ''}`);
      doc.moveDown(0.25);
    }

    doc.moveDown();
    doc.fontSize(10).text('注意：本檔為送件前檢核草稿，正式送件仍以官方格式及規定為準。');
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { filePath: outputPath };
}

async function exportLaborNhiOverlayPdf(outputPath, formType, payload) {
  const cfg = PDF_OVERLAY_CONFIG[formType];
  if (!cfg) throw new Error('此表單尚未設定官方 PDF 座標套印');

  const template = await fetchOfficialFormBuffer(cfg.templateKey);
  const pdfDoc = await PdfLibDocument.load(template);
  const page = pdfDoc.getPages()[cfg.page || 0];
  if (!page) throw new Error('找不到可套印頁面');

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  for (const [key, pos] of Object.entries(cfg.fields)) {
    const raw = payload ? payload[key] : '';
    if (!raw) continue;

    page.drawText(truncateValue(raw, pos.max || 50), {
      x: pos.x,
      y: pos.y,
      size: pos.size || cfg.defaultFontSize || 10,
      font,
      color: rgb(0.05, 0.05, 0.05),
    });
  }

  const out = await pdfDoc.save();
  fs.writeFileSync(outputPath, Buffer.from(out));
  return { filePath: outputPath };
}

module.exports = {
  OFFICIAL_FORMS,
  FORM_SCHEMAS,
  PDF_OVERLAY_CONFIG,
  getLaborFormSchemas,
  downloadOfficialForm,
  exportLaborNhiMappedWord,
  exportLaborNhiDraftWord,
  exportLaborNhiPdf,
  exportLaborNhiOverlayPdf,
};
