const PDFDocument = require('pdfkit');
const fs = require('fs');
const Excel = require('exceljs');

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('zh-TW', { maximumFractionDigits: 0 });
}

function exportPdfReport(filePath, input) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text('Tax Engine Pro 2025 計算報表', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text(`模組：${input.moduleType}`);
    doc.text(`年度：${input.year}`);
    doc.text(`時間：${new Date().toLocaleString('zh-TW')}`);

    doc.moveDown();
    doc.fontSize(13).text('結果摘要', { underline: true });
    const summary = input.result?.summary || {};
    Object.entries(summary).forEach(([key, value]) => {
      doc.fontSize(11).text(`${key}: ${formatCurrency(value)}`);
    });

    doc.moveDown();
    doc.fontSize(13).text('計算步驟', { underline: true });
    (input.result?.steps || []).forEach((step, idx) => {
      doc.fontSize(11).text(`${idx + 1}. ${step}`);
    });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function exportExcelReport(filePath, input) {
  const wb = new Excel.Workbook();
  const ws = wb.addWorksheet('Tax Report');

  ws.addRow(['Tax Engine Pro 2025 計算報表']);
  ws.addRow(['模組', input.moduleType]);
  ws.addRow(['年度', input.year]);
  ws.addRow(['時間', new Date().toLocaleString('zh-TW')]);
  ws.addRow([]);
  ws.addRow(['摘要鍵', '摘要值']);

  Object.entries(input.result?.summary || {}).forEach(([key, value]) => {
    ws.addRow([key, Number(value || 0)]);
  });

  ws.addRow([]);
  ws.addRow(['計算步驟']);
  (input.result?.steps || []).forEach((step, idx) => ws.addRow([`${idx + 1}. ${step}`]));

  await wb.xlsx.writeFile(filePath);
}

module.exports = { exportPdfReport, exportExcelReport };
