import { moduleConfig, type ModuleType } from '../types/modules';
import { Button, Card, Col, Divider, Form, InputNumber, Row, Space, Typography } from 'antd';

const { Text } = Typography;

interface Props {
  moduleType: ModuleType;
  year: number;
  onCalculate: (input: Record<string, number>) => Promise<void>;
  busy: boolean;
}

export function ModuleForm({ moduleType, year, onCalculate, busy }: Props) {
  const [form] = Form.useForm<Record<string, number>>();
  const cfg = moduleConfig[moduleType];

  const initialValues = cfg.fields.reduce<Record<string, number>>((acc, field) => {
    acc[field.key] = field.defaultValue;
    return acc;
  }, {});

  return (
    <Card title={`${cfg.title} - ${year}`}>
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={onCalculate}
      >
        <Row gutter={12}>
          {cfg.fields.map((field) => (
            <Col span={12} key={field.key}>
              <Form.Item name={field.key} label={field.label}>
                <InputNumber style={{ width: '100%' }} min={0} precision={0} step={1000} />
              </Form.Item>
            </Col>
          ))}
        </Row>
        <Divider />
        <Space>
          <Button type="primary" htmlType="submit" loading={busy}>
            即時計算
          </Button>
          <Text type="secondary">計算使用本機離線引擎（Decimal.js）</Text>
        </Space>
      </Form>
    </Card>
  );
}
