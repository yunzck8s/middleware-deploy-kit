import { Card, Row, Col, Statistic } from 'antd';
import {
  AppstoreOutlined,
  CloudServerOutlined,
  RocketOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const Dashboard = () => {
  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>仪表盘</h1>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="中间件总数"
              value={3}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="服务器总数"
              value={0}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="部署任务"
              value={0}
              prefix={<RocketOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="成功部署"
              value={0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }} title="快速开始">
        <p>欢迎使用中间件离线部署管理平台！</p>
        <p>当前可部署的中间件：</p>
        <ul>
          <li>Nginx 1.28.0（支持 SSL）</li>
          <li>Redis 6.2.20</li>
          <li>OpenSSH 10.0p2</li>
        </ul>
        <p>后续版本将支持：MySQL、PostgreSQL、Kafka、RabbitMQ 等</p>
      </Card>
    </div>
  );
};

export default Dashboard;
