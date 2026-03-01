import { Alert, Button, Card, Descriptions, Input, List, Space, Tag, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';

const { Text } = Typography;

interface Props {
  initialTaxId?: string;
  onApplyName?: (taxId: string, name: string) => void;
}

function fmtDate(v?: string) {
  if (!v) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return v;
}

export function PublicRegistryPanel({ initialTaxId, onApplyName }: Props) {
  const [taxId, setTaxId] = useState(initialTaxId || '');
  const [batchInput, setBatchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [notice, setNotice] = useState<string>('');

  useEffect(() => {
    if (initialTaxId) setTaxId(initialTaxId);
  }, [initialTaxId]);

  const items = useMemo(() => result?.businessItems || result?.business_items || [], [result]);

  const lookup = async () => {
    const cleaned = taxId.replace(/\D/g, '');
    if (!/^\d{8}$/.test(cleaned)) return message.warning('請輸入 8 碼統編');

    setLoading(true);
    setNotice('');
    try {
      const res = await window.electronAPI.lookupRegistryByTaxId(cleaned);
      if (!res.ok) {
        message.error(res.message || '查詢失敗');
        return;
      }
      setResult(res.data);
      if (res.cached) {
        setNotice(res.message || '目前顯示本機快取資料');
        message.warning('網路不可用，已載入快取資料');
      } else {
        message.success('已取得最新公開資料並快取到本機');
      }
      if (onApplyName && res.data?.entity_name) {
        onApplyName(cleaned, res.data.entity_name);
      } else if (onApplyName && res.data?.entityName) {
        onApplyName(cleaned, res.data.entityName);
      }
    } finally {
      setLoading(false);
    }
  };

  const syncAllClients = async () => {
    setSyncing(true);
    try {
      const res = await window.electronAPI.syncRegistryForAllClients();
      message.info(`同步完成：成功 ${res.success} / ${res.total}，失敗 ${res.failed}`);
    } finally {
      setSyncing(false);
    }
  };

  const syncBatchTaxIds = async () => {
    const ids = Array.from(
      new Set(
        batchInput
          .split(/[\s,;]+/)
          .map((x) => x.replace(/\D/g, ''))
          .filter((x) => /^\d{8}$/.test(x))
      )
    );
    if (ids.length === 0) return message.warning('請輸入至少一筆有效統編（8碼）');

    setSyncing(true);
    try {
      const res = await window.electronAPI.syncRegistryByTaxIds(ids);
      message.info(`批次完成：成功 ${res.success} / ${res.total}，失敗 ${res.failed}`);
    } finally {
      setSyncing(false);
    }
  };

  const name = result?.entityName || result?.entity_name || '-';
  const responsible = result?.responsibleName || result?.responsible_name || '-';
  const status = result?.statusDesc || result?.status_desc || '-';
  const changeDate = result?.latestChangeDate || result?.latest_change_date || '';
  const setupDate = result?.setupDate || result?.setup_date || '';
  const address = result?.address || '-';
  const authority = result?.authorityDesc || result?.authority_desc || '-';
  const type = result?.entityType || result?.entity_type || '-';

  return (
    <Card title="公開資料整合（公司/行號）" extra={<Button onClick={syncAllClients} loading={syncing}>同步全部客戶統編</Button>}>
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
        <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="輸入統編（8碼）" />
        <Button type="primary" loading={loading} onClick={lookup}>查詢並快取</Button>
      </Space.Compact>

      <Input.TextArea
        rows={3}
        value={batchInput}
        onChange={(e) => setBatchInput(e.target.value)}
        placeholder="批量輸入統編：可用換行、逗號、空白分隔；例如 20828393, 15725713"
        style={{ marginBottom: 8 }}
      />
      <Space style={{ marginBottom: 12 }}>
        <Button onClick={syncBatchTaxIds} loading={syncing}>批次同步輸入統編</Button>
        <Button onClick={() => setBatchInput('')}>清空批量欄位</Button>
      </Space>

      {notice && <Alert type="warning" showIcon message={notice} style={{ marginBottom: 12 }} />}

      {result && (
        <>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="統編">{result.taxId || result.tax_id}</Descriptions.Item>
            <Descriptions.Item label="類型">
              <Tag color={type === 'company' ? 'blue' : 'green'}>{type === 'company' ? '公司' : type === 'business' ? '行號' : type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="名稱">{name}</Descriptions.Item>
            <Descriptions.Item label="負責人">{responsible}</Descriptions.Item>
            <Descriptions.Item label="狀態">{status}</Descriptions.Item>
            <Descriptions.Item label="最近變更日">{fmtDate(changeDate)}</Descriptions.Item>
            <Descriptions.Item label="設立日">{fmtDate(setupDate)}</Descriptions.Item>
            <Descriptions.Item label="主管機關">{authority}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>{address}</Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 12 }}>
            <Text strong>登記營業項目（{items.length}）</Text>
            <List
              bordered
              size="small"
              style={{ marginTop: 8, maxHeight: 240, overflow: 'auto' }}
              dataSource={items}
              locale={{ emptyText: '查無營業項目' }}
              renderItem={(it: any) => (
                <List.Item>
                  <Text code>{it.itemCode || it.item_code || '-'}</Text>
                  <Text>{it.itemDesc || it.item_desc || '-'}</Text>
                </List.Item>
              )}
            />
          </div>
        </>
      )}
    </Card>
  );
}
