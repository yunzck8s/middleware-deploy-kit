import { Card, Row, Col, Empty } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import type { MiddlewarePackage } from '../../types';

interface PackageSelectorProps {
  type: string;
  packages: MiddlewarePackage[];
  selectedPackage: MiddlewarePackage | null;
  onSelect: (pkg: MiddlewarePackage) => void;
}

export default function PackageSelector({ type, packages, selectedPackage, onSelect }: PackageSelectorProps) {
  const filteredPackages = packages.filter(pkg => pkg.name === type);

  if (filteredPackages.length === 0) {
    return <Empty description={`暂无 ${type} 离线包`} />;
  }

  return (
    <Row gutter={[16, 16]}>
      {filteredPackages.map(pkg => (
        <Col key={pkg.id} span={12}>
          <Card
            hoverable
            style={{
              border: selectedPackage?.id === pkg.id ? '2px solid #1890ff' : '1px solid #d9d9d9',
              cursor: 'pointer'
            }}
            onClick={() => onSelect(pkg)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0 }}>{pkg.display_name || pkg.name}</h4>
                <p style={{ margin: '4px 0', color: '#666' }}>版本：{pkg.version}</p>
                <p style={{ margin: '4px 0', color: '#666' }}>
                  大小：{(pkg.file_size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              {selectedPackage?.id === pkg.id && (
                <CheckCircleFilled style={{ color: '#52c41a', fontSize: 24 }} />
              )}
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
