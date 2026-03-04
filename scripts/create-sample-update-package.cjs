const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { computeManifestSha256 } = require('../electron/update-package.cjs');

const outDir = path.join(process.cwd(), 'resources');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const manifest = {
  packageId: 'sample-2025-03-01',
  targetYear: 2025,
  minAppVersion: '0.0.0',
  manifestSha256: '',
};
manifest.manifestSha256 = computeManifestSha256(manifest);

const laws = [
  {
    lawName: '所得稅法',
    articleNumber: '120',
    title: '示範更新條文',
    content: '此為離線更新包測試條文。',
    tags: '測試,更新包',
    effectiveDate: '2025-03-01',
  },
];

const rates = [
  {
    moduleType: 'withholding',
    year: 2025,
    rateData: { serviceRate: 0.11 },
    effectiveDate: '2025-03-01',
  },
];

const zip = new AdmZip();
zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
zip.addFile('payload/laws.json', Buffer.from(JSON.stringify(laws, null, 2), 'utf8'));
zip.addFile('payload/rates.json', Buffer.from(JSON.stringify(rates, null, 2), 'utf8'));

const output = path.join(outDir, 'sample-update-package.zip');
zip.writeZip(output);
console.log(output);
