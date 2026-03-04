import { AppstoreOutlined, BookOutlined, HomeOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Input, Layout, Menu, Progress, Row, Select, Space, Statistic, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleForm } from './components/ModuleForm';
import { ResultPanel } from './components/ResultPanel';
import { LawSearch } from './components/LawSearch';
import { UpdatePanel } from './components/UpdatePanel';
import { HistoryPanel } from './components/HistoryPanel';
import { LaborFormPanel } from './components/LaborFormPanel';
import { PublicRegistryPanel } from './components/PublicRegistryPanel';
import { useAppStore } from './store/useAppStore';
import type { CalculationResult, TaxClient } from './types/app';
import type { ModuleType } from './types/modules';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

type ViewKey = 'home' | 'module';
type InitStatus = { ready: boolean; phase: string; message: string; progress: number; error: string | null };

function App() {
  const { selectedClientId, selectedModule, setSelectedClientId, setSelectedModule, year, setYear, lastResult, setLastResult } = useAppStore();

  const [activeView, setActiveView] = useState<ViewKey>('home');
  const [stats, setStats] = useState({ clients: 0, history: 0, laws: 0, registryCache: 0 });
  const [clients, setClients] = useState<TaxClient[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientTaxId, setClientTaxId] = useState('');
  const [busy, setBusy] = useState(false);
  const [initStatus, setInitStatus] = useState<InitStatus>({
    ready: false,
    phase: 'boot',
    message: '啟動中',
    progress: 0,
    error: null,
  });

  const moduleItems = useMemo(() => [
    { key: 'corp_income', label: '營利事業所得稅', icon: <AppstoreOutlined /> },
    { key: 'vat', label: '營業稅', icon: <AppstoreOutlined /> },
    { key: 'personal_income', label: '綜合所得稅', icon: <AppstoreOutlined /> },
    { key: 'labor_nhi', label: '勞健保', icon: <AppstoreOutlined /> },
    { key: 'withholding', label: '扣繳申報', icon: <AppstoreOutlined /> },
  ], []);

  const menuItems = useMemo(() => [
    { key: 'home', label: '首頁', icon: <HomeOutlined /> },
    { type: 'divider' as const },
    ...moduleItems,
  ], [moduleItems]);

  const refreshBaseData = useCallback(async () => {
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
  }, [selectedClientId, setSelectedClientId]);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = window.electronAPI.onAppInitStatus((status) => {
      if (!mounted) return;
      setInitStatus(status);
    });
    void window.electronAPI.getAppInitStatus().then((status) => {
      if (mounted) setInitStatus(status);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initStatus.ready) return;
    void refreshBaseData();
  }, [initStatus.ready, refreshBaseData]);

  const runCalculation = async (input: Record<string, number>) => {
    setBusy(true);
    try {
      const result = await window.electronAPI.runCalculation({
        moduleType: selectedModule,
        year,
        input,
      }) as CalculationResult;
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
    if (r.ok && r.backupPath) message.success(`備份完成: ${r.backupPath}`);
  };

  const handleMenuClick = (key: string) => {
    if (key === 'home') {
      setActiveView('home');
      return;
    }
    setActiveView('module');
    setSelectedModule(key as ModuleType);
  };

  if (!initStatus.ready) {
    return (
      <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Card style={{ width: 540 }} title="Tax Engine Pro 2025">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Text>{initStatus.message || '載入中...'}</Text>
              <Progress
                percent={Math.max(1, Math.min(100, Math.round(initStatus.progress)))}
                status={initStatus.error ? 'exception' : 'active'}
                strokeColor={initStatus.error ? undefined : '#1677ff'}
              />
              {initStatus.error && <Alert type="error" showIcon message={initStatus.error} />}
              {!initStatus.error && <Text type="secondary">正在啟動元件與資料庫，請稍候。</Text>}
            </Space>
          </Card>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} theme="light">
        <div style={{ padding: 16 }}>
          <Title level={4} style={{ margin: 0 }}>Tax Engine Pro 2025</Title>
          <Text type="secondary">離線桌面稅務計算系統</Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeView === 'home' ? 'home' : selectedModule]}
          items={menuItems}
          onClick={(e) => handleMenuClick(e.key)}
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
          {activeView === 'home' ? (
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

              <Col span={12}><LawSearch /></Col>
              <Col span={12}><HistoryPanel selectedClientId={selectedClientId} /></Col>
            </Row>
          ) : (
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Alert
                  type="success"
                  showIcon
                  message="計算模式：僅顯示模組輸入與結果；共用查詢與客戶管理請回首頁。"
                />
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
            </Row>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
