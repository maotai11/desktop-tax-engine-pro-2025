import { Button, Card, Input, Space, Typography, message } from 'antd';
import { useState } from 'react';

const { Text } = Typography;

export function UpdatePanel() {
  const [zipPath, setZipPath] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('尚未驗證');
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    setBusy(true);
    try {
      const result = await window.electronAPI.verifyUpdate(zipPath);
      setVerifyMessage(result.message);
      if (!result.ok) message.error(result.message);
      else message.success(result.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    try {
      const result = await window.electronAPI.applyUpdate(zipPath);
      if (!result.ok) message.error(result.message);
      else message.success(result.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="離線更新包">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input value={zipPath} onChange={(e) => setZipPath(e.target.value)} placeholder="輸入 ZIP 絕對路徑" />
        <Space>
          <Button onClick={verify} loading={busy}>驗證更新包</Button>
          <Button type="primary" onClick={apply} loading={busy}>套用更新包</Button>
        </Space>
        <Text type="secondary">{verifyMessage}</Text>
      </Space>
    </Card>
  );
}
