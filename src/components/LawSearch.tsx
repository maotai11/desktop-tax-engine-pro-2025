import { Button, Card, Input, List, Select, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';

const { Paragraph, Text } = Typography;

export function LawSearch() {
  const [keyword, setKeyword] = useState('');
  const [lawName, setLawName] = useState<string | undefined>(undefined);
  const [lawNames, setLawNames] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async (nextKeyword = keyword, nextLawName = lawName) => {
    setLoading(true);
    try {
      const rows = await window.electronAPI.searchLaws({
        keyword: nextKeyword,
        lawName: nextLawName,
      });
      setResults(rows);
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = async () => {
    setKeyword('');
    setLawName(undefined);
    await runSearch('', undefined);
  };

  useEffect(() => {
    const init = async () => {
      const names = await window.electronAPI.listLawNames();
      setLawNames(names);
      await runSearch('', undefined);
    };
    void init();
  }, []);

  return (
    <Card title="法規查詢">
      <Space style={{ width: '100%', marginBottom: 12 }} direction="vertical">
        <Select
          allowClear
          showSearch
          value={lawName}
          onChange={(v) => setLawName(v)}
          placeholder="先選法規（可不選）"
          options={lawNames.map((name) => ({ label: name, value: name }))}
          optionFilterProp="label"
        />
        <Space.Compact style={{ width: '100%' }}>
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="輸入關鍵字或條號" />
          <Button type="primary" loading={loading} onClick={() => void runSearch()}>
            搜尋
          </Button>
          <Button onClick={() => void resetSearch()}>
            清除
          </Button>
        </Space.Compact>
      </Space>

      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        共 {results.length} 筆（依法規、條號排序）
      </Text>

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
