# Desktop Tax Engine Pro 2025

離線桌面稅務計算系統（Windows 優先，免登入）。

## 功能

- 六大模組：營所稅、營業稅、綜所稅、勞健保、扣繳申報
- 法規全文檢索（SQLite FTS5）
- 公開資料整合（商工登記）：
  - 輸入統編自動帶出公司/行號名稱、負責人、登記營業項目、最近核准變更日
  - 查詢結果自動快取到本機 DB，離線可回查
  - 可批次同步「所有既有客戶」統編公開資料
- 計算歷史保存
- PDF / Excel 匯出
- 離線更新包（ZIP）驗證與套用
- 本機資料庫備份
- 勞健保表單作業：
  - 下載官方 Word/PDF 表單（勞保局）
  - 官方欄位 1:1 對照輸入（可由外部 JSON/CSV 套入）
  - 生成 1:1 套入版 Word
  - 輸入後匯出可手動編輯 Word 草稿
  - 輸出 PDF 草稿供列印
  - 官方 PDF 座標套印版（目前支援勞健保合一表）

## 開發啟動

```bash
npm install
npm run dev
```

## 打包（Windows）

```bash
npm run build:win
```

`dist/win-unpacked/Tax Engine Pro 2025.exe` 可免安裝直接執行（需保留整個 `win-unpacked` 目錄）。

離線資料庫若放在 `exe` 同資料夾、檔名為 `tax-engine-pro-2025.db`，程式會優先使用該檔案。

## 產生測試更新包

```bash
node scripts/create-sample-update-package.cjs
```

會在 `resources/sample-update-package.zip` 生成範例更新包，可在 App 的「離線更新包」面板輸入絕對路徑後驗證/套用。

## 下載並匯入法條（官方來源）

```bash
npm run import:laws
```

此指令會從「全國法規資料庫」下載並寫入本機 DB，目前預設匯入：

- 所得稅法（G0340003）
- 所得稅法施行細則（G0340004）
- 營利事業所得稅查核準則（G0340051）
- 加值型及非加值型營業稅法（G0340080）
- 加值型及非加值型營業稅法施行細則（G0340081）
- 統一發票使用辦法（G0340082）
- 各類所得扣繳率標準（G0340028）
- 稅捐稽徵法（G0340001）
- 稅捐稽徵法施行細則（G0340039）
- 所得基本稅額條例（G0340115）
- 所得基本稅額條例施行細則（G0340116）
- 適用所得稅協定查核準則（G0340125）
- 勞工保險條例（N0050001）
- 勞工保險條例施行細則（N0050002）
- 全民健康保險法（L0060001）
- 全民健康保險法施行細則（L0060002）
- 勞工退休金條例（N0030020）
- 勞工退休金條例施行細則（N0030021）

預設 DB 路徑：

- `C:\Users\LIN\AppData\Roaming\desktop-tax-engine-pro-2025\tax-engine-pro-2025.db`

## 匯入全量稅籍資料（統編離線查詢）

先下載官方全量 ZIP（政府資料開放平台）：

- `https://eip.fia.gov.tw/data/BGMOPEN1.zip`

再執行匯入：

```bash
npm run import:tax-registry-full -- --zip=C:\path\to\BGMOPEN1.zip
```

說明：

- 會把全量統編資料寫入 `public_registry_cache`，可供離線依統編查詢
- 若要保留既有快取並做增量覆蓋，可加參數 `--keep-existing=1`
## 資料位置

- SQLite DB：Electron `app.getPath('userData')` 目錄下 `tax-engine-pro-2025.db`

## 注意

- 目前為免登入模式，開啟即用，資料僅存本機。
- 稅務公式為首版可運作樣板，正式上線前請替換為完整 2025 法規公式與基準測試案例。
