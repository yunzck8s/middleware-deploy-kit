import React from 'react';
import { Row, Col, Card, Empty, Spin } from 'antd';
import type { CardProps } from 'antd';

export interface CardViewProps<T> {
  data: T[];
  loading?: boolean;
  renderCard: (item: T, index: number) => React.ReactNode;
  emptyText?: string;
  gutter?: [number, number];
  colSpan?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    xxl?: number;
  };
  cardProps?: CardProps;
}

/**
 * 通用卡片视图组件
 * 用于展示列表数据的卡片视图
 */
function CardView<T>({
  data,
  loading = false,
  renderCard,
  emptyText = '暂无数据',
  gutter = [16, 16],
  colSpan = { xs: 24, sm: 12, lg: 8, xl: 6 },
  cardProps,
}: CardViewProps<T>) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card {...cardProps}>
        <Empty description={emptyText} />
      </Card>
    );
  }

  return (
    <Row gutter={gutter}>
      {data.map((item, index) => (
        <Col key={index} {...colSpan}>
          {renderCard(item, index)}
        </Col>
      ))}
    </Row>
  );
}

export default CardView;
