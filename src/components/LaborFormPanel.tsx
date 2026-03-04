import { Button, Card, Col, Form, Input, Row, Select, Space, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';

const { Text } = Typography;

type SchemaField = { key: string; label: string };
type FormSchema = { label: string; officialDownloadKeys: string[]; fields: SchemaField[] };

const DOWNLOAD_LABELS: Record<string, string> = {
  laborNhiCombined_doc: '官方合一表 Word',
  laborNhiCombined_pdf: '官方合一表 PDF',
  nhiOnlyAdd_doc: '官方健保加保 Word',
  nhiOnlyWithdraw_doc: '官方健保退保 Word',
};

function tryParseExternal(text: string, fields: SchemaField[]) {
  const trimmed = text.trim();
  if (!trimmed) return {};

  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const f of fields) {
      const v = obj[f.key] ?? obj[f.label];
      if (v !== undefined && v !== null) out[f.key] = String(v);
    }
    return out;
  } catch {
    const out: Record<string, string> = {};
    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/\t|,|:/).map((p) => p.trim());
      if (parts.length < 2) continue;
      const k = parts[0];
      const v = parts.slice(1).join(' ');
      const found = fields.find((f) => f.key === k || f.label === k);
      if (found) out[found.key] = v;
    }
    return out;
  }
}

export function LaborFormPanel() {
  const [form] = Form.useForm<Record<string, string>>();
  const [schemas, setSchemas] = useState<Record<string, FormSchema>>({});
  const [formType, setFormType] = useState('nhi_only_add');
  const [loadingKey, setLoadingKey] = useState('');
  const [exporting, setExporting] = useState(false);
  const [externalInput, setExternalInput] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      const data = await window.electronAPI.getLaborFormSchemas();
      if (!active) return;
      setSchemas(data);
      const first = Object.keys(data)[0];
      setFormType((prev) => (data[prev] ? prev : first || prev));
    })();
    return () => {
      active = false;
    };
  }, []);

  const current = schemas[formType];
  const fields = useMemo(() => current?.fields ?? [], [current]);
  const downloadKeys = useMemo(() => current?.officialDownloadKeys ?? [], [current]);
  const canOverlayPdf = downloadKeys.includes('laborNhiCombined_pdf');

  const initialJson = useMemo(() => {
    const obj: Record<string, string> = {};
    for (const f of fields) obj[f.key] = '';
    return JSON.stringify(obj, null, 2);
  }, [fields]);

  useEffect(() => {
    form.resetFields();
  }, [form, formType]);

  const downloadOfficial = async (key: string) => {
    setLoadingKey(key);
    try {
      const result = await window.electronAPI.downloadOfficialLaborForm(key);
      if (result.ok) message.success(`已下載：${result.filePath}`);
      else message.error(result.message || '下載失敗');
    } catch (error) {
      message.error(`下載失敗: ${(error as Error).message}`);
    } finally {
      setLoadingKey('');
    }
  };

  const applyExternalInput = () => {
    const mapped = tryParseExternal(externalInput, fields);
    form.setFieldsValue(mapped);
    message.success(`已套入 ${Object.keys(mapped).length} 個欄位`);
  };

  const exportMappedWord = async () => {
    setExporting(true);
    try {
      const values = await form.validateFields();
      const result = await window.electronAPI.exportLaborNhiMappedWord(formType, values);
      if (result.ok) message.success(`1:1 套入版已輸出：${result.filePath}`);
      else message.info(result.message || '已取消');
    } finally {
      setExporting(false);
    }
  };

  const exportDraftWord = async () => {
    setExporting(true);
    try {
      const values = await form.validateFields();
      const result = await window.electronAPI.exportLaborNhiDraftWord(formType, values);
      if (result.ok) message.success(`草稿版已輸出：${result.filePath}`);
      else message.info(result.message || '已取消');
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const values = await form.validateFields();
      const result = await window.electronAPI.exportLaborNhiPdf(formType, values);
      if (result.ok) message.success(`PDF 已輸出：${result.filePath}`);
      else message.info(result.message || '已取消');
    } finally {
      setExporting(false);
    }
  };

  const exportOverlayPdf = async () => {
    setExporting(true);
    try {
      const values = await form.validateFields();
      const result = await window.electronAPI.exportLaborNhiOverlayPdf(formType, values);
      if (result.ok) message.success(`官方套印版 PDF 已輸出：${result.filePath}`);
      else message.info(result.message || '已取消');
    } catch (error) {
      message.error(`套印失敗: ${(error as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card title="勞健保官方欄位 1:1 對照填表">
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Text strong>表單類型</Text>
          <Select
            style={{ width: 360, marginLeft: 8 }}
            value={formType}
            options={Object.entries(schemas).map(([k, v]) => ({ value: k, label: v.label }))}
            onChange={setFormType}
          />
        </div>

        <div>
          <Text strong>1) 下載官方表格</Text>
          <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
            {downloadKeys.map((key) => (
              <Col key={key} span={8}>
                <Button block loading={loadingKey === key} onClick={() => void downloadOfficial(key)}>
                  {DOWNLOAD_LABELS[key] || key}
                </Button>
              </Col>
            ))}
          </Row>
          <Text type="secondary">下載位置：Downloads\TaxEnginePro2025\official-forms</Text>
        </div>

        <div>
          <Text strong>2) 外部表格輸入（JSON 或 CSV/TSV）</Text>
          <Input.TextArea
            rows={7}
            value={externalInput}
            onChange={(e) => setExternalInput(e.target.value)}
            placeholder={'可貼 JSON，或每行 key,value。key 可用欄位代碼或欄位中文名稱。'}
            style={{ marginTop: 8 }}
          />
          <Space style={{ marginTop: 8 }}>
            <Button onClick={() => setExternalInput(initialJson)}>載入範例 JSON</Button>
            <Button onClick={applyExternalInput}>套入外部輸入</Button>
          </Space>
        </div>

        <div>
          <Text strong>3) 官方欄位輸入（1:1 對照）</Text>
          <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
            <Row gutter={12}>
              {fields.map((f) => (
                <Col key={f.key} span={12}>
                  <Form.Item name={f.key} label={f.label}>
                    <Input />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
        </div>

        <div>
          <Space>
            <Button type="primary" onClick={() => void exportMappedWord()} loading={exporting}>生成 1:1 套入版 Word</Button>
            <Button onClick={() => void exportDraftWord()} loading={exporting}>生成可編輯草稿 Word</Button>
            <Button onClick={() => void exportPdf()} loading={exporting}>列印用 PDF</Button>
            <Button disabled={!canOverlayPdf} onClick={() => void exportOverlayPdf()} loading={exporting}>官方 PDF 座標套印版</Button>
          </Space>
          {!canOverlayPdf && <div><Text type="secondary">此表單目前無官方 PDF 套印模板，請用 Word 套入或草稿版。</Text></div>}
        </div>
      </Space>
    </Card>
  );
}
