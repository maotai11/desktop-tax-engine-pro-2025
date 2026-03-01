import { Button, Card, List,  Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';

const { Text } = Typography;

export function HistoryPanel({ selectedClientId }: { selectedClientId?: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      setRows(await window.electronAPI.listHistory(selectedClientId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [selectedClientId]);

  const exportReport = async (row: any, type: 'pdf' | 'excel') => {
    const input = {
      moduleType: row.module_type,
      year: row.year,
      payload: JSON.parse(row.payload),
      result: JSON.parse(row.result),
    };

    const res = type === 'pdf' ? await window.electronAPI.exportPdf(input) : await window.electronAPI.exportExcel(input);
    if (res.ok) message.success(`已匯出: ${res.filePath}`);
    else message.info(res.message || '已取消');
  };

  return (
    <Card title="歷史紀錄與報表匯出" extra={<Button onClick={loadHistory} loading={loading}>重新整理</Button>}>
      <List
        size="small"
        dataSource={rows}
        renderItem={(row: any) => (
          <List.Item
            actions={[
              <Button key="pdf" size="small" onClick={() => exportReport(row, 'pdf')}>PDF</Button>,
              <Button key="xlsx" size="small" onClick={() => exportReport(row, 'excel')}>Excel</Button>,
            ]}
          >
            <Space direction="vertical" size={0}>
              <Text strong>{row.module_type} / {row.year}</Text>
              <Text type="secondary">{row.created_at}</Text>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
}
