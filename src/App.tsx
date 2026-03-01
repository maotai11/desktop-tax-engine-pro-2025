import { AppstoreOutlined, BookOutlined,  UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Input, Layout, Menu, Row, Select, Space, Statistic, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { ModuleForm } from './components/ModuleForm';
import { ResultPanel } from './components/ResultPanel';
import { LawSearch } from './components/LawSearch';
import { UpdatePanel } from './components/UpdatePanel';
import { HistoryPanel } from './components/HistoryPanel';
import { LaborFormPanel } from './components/LaborFormPanel';
import { PublicRegistryPanel } from './components/PublicRegistryPanel';
import { useAppStore } from './store/useAppStore';
import type { ModuleType } from './types/modules';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

function App() {
  const { selectedClientId, selectedModule, setSelectedClientId, setSelectedModule, year, setYear, lastResult, setLastResult } = useAppStore();

  const [stats, setStats] = useState({ clients: 0, history: 0, laws: 0, registryCache: 0 });
  const [clients, setClients] = useState<any[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientTaxId, setClientTaxId] = useState('');
  const [busy, setBusy] = useState(false);

  const moduleItems = useMemo(() => [
    { key: 'corp_income', label: '營利事業所得稅', icon: <AppstoreOutlined /> },
    { key: 'vat', label: '營業稅', icon: <AppstoreOutlined /> },
    { key: 'personal_income', label: '綜合所得稅', icon: <AppstoreOutlined /> },
    { key: 'labor_nhi', label: '勞健保', icon: <AppstoreOutlined /> },
    { key: 'withholding', label: '扣繳申報', icon: <AppstoreOutlined /> },
  ], []);

  const refreshBaseData = async () => {
    const [clientRows, dashboard] = await Promise.all([
      window.electronAPI.listClients(),
      window.electronAPI.getDashboardStats(),
    ]);
    setClients(clientRows);
    setStats({
      clients: dashboard.clients,
      history: dashboard.history,
      laws: dashboard.laws,
      registryCache: dashboard.registryCache || 0,
    });
    if (!selectedClientId && clientRows.length) setSelectedClientId(clientRows[0].id);
  };

  useEffect(() => {
    void refreshBaseData();
  }, []);

  const runCalculation = async (input: Record<string, number>) => {
    setBusy(true);
    try {
      const result = await window.electronAPI.runCalculation({
        moduleType: selectedModule,
        year,
        input,
      });
      setLastResult(result);
      await window.electronAPI.saveCalculation({
        clientId: selectedClientId,
        moduleType: selectedModule,
        year,
        payload: input,
        result,
      });
      await refreshBaseData();
      message.success('計算完成並已儲存');
    } catch (error) {
      message.error(`計算失敗: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const createClient = async () => {
    if (!clientName || !clientTaxId) return message.warning('請輸入客戶名稱與統編');
    try {
      const client = await window.electronAPI.createClient({ taxId: clientTaxId, name: clientName });
      setClientName('');
      setClientTaxId('');
      setSelectedClientId(client.id);
      await refreshBaseData();
      message.success('客戶新增成功');
    } catch (error) {
      message.error(`新增失敗: ${(error as Error).message}`);
    }
  };

  const applyRegistryName = (taxId: string, name: string) => {
    if (!clientTaxId) setClientTaxId(taxId);
    if (!clientName) setClientName(name);
  };

  const backupDb = async () => {
    const r = await window.electronAPI.backupDb();
    if (r.ok) message.success(`備份完成: ${r.backupPath}`);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} theme="light">
        <div style={{ padding: 16 }}>
          <Title level={4} style={{ margin: 0 }}>Tax Engine Pro 2025</Title>
          <Text type="secondary">離線桌面稅務計算系統</Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedModule]}
          items={moduleItems}
          onClick={(e) => setSelectedModule(e.key as ModuleType)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Select
              style={{ width: 320 }}
              value={selectedClientId}
              options={clients.map((c) => ({ value: c.id, label: `${c.name} (${c.tax_id})` }))}
              onChange={setSelectedClientId}
            />
            <Select value={year} style={{ width: 120 }} options={[2025, 2026].map((y) => ({ value: y, label: `${y}` }))} onChange={setYear} />
          </Space>
          <Button onClick={backupDb} icon={<UploadOutlined />}>資料庫備份</Button>
        </Header>
        <Content style={{ padding: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={6}><Card><Statistic title="客戶數" value={stats.clients} /></Card></Col>
            <Col span={6}><Card><Statistic title="計算紀錄" value={stats.history} /></Card></Col>
            <Col span={6}><Card><Statistic title="法條筆數" value={stats.laws} /></Card></Col>
            <Col span={6}><Card><Statistic title="公開資料快取" value={stats.registryCache} /></Card></Col>

            <Col span={24}>
              <Alert
                type="info"
                showIcon
                message="免登入模式：開啟即用，資料僅儲存於本機。"
              />
            </Col>

            <Col span={12}>
              <Card title="新增客戶" extra={<BookOutlined />}>
                <Space.Compact style={{ width: '100%' }}>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="客戶名稱" />
                  <Input value={clientTaxId} onChange={(e) => setClientTaxId(e.target.value)} placeholder="統一編號" />
                  <Button type="primary" onClick={createClient}>新增</Button>
                </Space.Compact>
              </Card>
            </Col>

            <Col span={12}>
              <UpdatePanel />
            </Col>

            <Col span={24}>
              <PublicRegistryPanel initialTaxId={clientTaxId} onApplyName={applyRegistryName} />
            </Col>

            <Col span={12}>
              <ModuleForm moduleType={selectedModule} year={year} onCalculate={runCalculation} busy={busy} />
            </Col>
            <Col span={12}>
              <ResultPanel result={lastResult} />
            </Col>

            {selectedModule === 'labor_nhi' && (
              <Col span={24}>
                <LaborFormPanel />
              </Col>
            )}

            <Col span={12}><LawSearch /></Col>
            <Col span={12}><HistoryPanel selectedClientId={selectedClientId} /></Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
