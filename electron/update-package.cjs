const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function verifyUpdatePackage(zipPath) {
  if (!fs.existsSync(zipPath)) {
    return { ok: false, message: '找不到更新包檔案' };
  }

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().map((e) => e.entryName);
  if (!entries.includes('manifest.json')) {
    return { ok: false, message: 'manifest.json 缺失' };
  }

  const manifest = JSON.parse(zip.readAsText('manifest.json'));
  const computed = sha256(zip.readAsText('manifest.json'));
  const valid = !manifest.manifestSha256 || manifest.manifestSha256 === computed;

  return {
    ok: valid,
    message: valid ? '更新包驗證通過' : 'manifest checksum 不符',
    manifest,
  };
}

function applyUpdatePackage(zipPath, dbApi) {
  const check = verifyUpdatePackage(zipPath);
  if (!check.ok) return check;

  const zip = new AdmZip(zipPath);
  const manifest = check.manifest;

  try {
    const lawsPath = 'payload/laws.json';
    const ratesPath = 'payload/rates.json';

    if (zip.getEntries().some((e) => e.entryName === lawsPath)) {
      const laws = JSON.parse(zip.readAsText(lawsPath));
      laws.forEach((law) => dbApi.upsertLaw(law));
    }

    if (zip.getEntries().some((e) => e.entryName === ratesPath)) {
      const rates = JSON.parse(zip.readAsText(ratesPath));
      rates.forEach((rate) => dbApi.upsertTaxRate(rate.moduleType, rate.year, rate.rateData, rate.effectiveDate));
    }

    dbApi.addUpdateAudit(manifest.packageId || path.basename(zipPath), 'success', 'offline package applied');
    return { ok: true, message: '更新包套用完成', manifest };
  } catch (error) {
    dbApi.addUpdateAudit(manifest.packageId || path.basename(zipPath), 'failed', String(error));
    return { ok: false, message: `更新失敗: ${error.message}` };
  }
}

module.exports = { verifyUpdatePackage, applyUpdatePackage };
