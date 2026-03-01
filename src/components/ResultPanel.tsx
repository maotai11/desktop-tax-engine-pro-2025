import { Card, List, Typography } from 'antd';

const { Text } = Typography;

export function ResultPanel({ result }: { result: any }) {
  if (!result) {
    return <Card title="計算結果">尚未計算</Card>;
  }

  return (
    <Card title="計算結果">
      <List
        size="small"
        bordered
        header={<strong>摘要</strong>}
        dataSource={Object.entries(result.summary || {})}
        renderItem={([key, value]) => (
          <List.Item>
            <Text>{String(key)}</Text>
            <Text strong>{Number(value || 0).toLocaleString('zh-TW')}</Text>
          </List.Item>
        )}
      />
      <List
        style={{ marginTop: 16 }}
        size="small"
        header={<strong>計算步驟</strong>}
        dataSource={result.steps || []}
        renderItem={(item: string) => <List.Item>{item}</List.Item>}
      />
    </Card>
  );
}
