import { Button, Card, Input, List, Space, Typography } from 'antd';
import { useState } from 'react';

const { Paragraph, Text } = Typography;

export function LawSearch() {
  const [keyword, setKeyword] = useState('所得稅法');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async () => {
    setLoading(true);
    try {
      const rows = await window.electronAPI.searchLaws(keyword);
      setResults(rows);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="法規查詢（FTS5）">
      <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
        <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="輸入關鍵字或條號" />
        <Button type="primary" loading={loading} onClick={runSearch}>
          搜尋
        </Button>
      </Space.Compact>

      <List
        bordered
        size="small"
        dataSource={results}
        renderItem={(row: any) => (
          <List.Item>
            <div>
              <Text strong>{row.law_name} 第{row.article_number}條 - {row.title}</Text>
              <Paragraph style={{ marginBottom: 0 }} ellipsis={{ rows: 2, expandable: true }}>
                {row.content}
              </Paragraph>
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
}
