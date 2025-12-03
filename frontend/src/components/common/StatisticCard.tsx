import React from 'react';
import { Card, Statistic, Skeleton } from 'antd';
import type { StatisticProps } from 'antd';

export interface StatisticCardProps extends StatisticProps {
  loading?: boolean;
  onClick?: () => void;
  hoverable?: boolean;
}

/**
 * 统计卡片组件
 * 用于展示关键指标，如中间件总数、服务器总数等
 */
const StatisticCard: React.FC<StatisticCardProps> = ({
  loading = false,
  onClick,
  hoverable = false,
  ...statisticProps
}) => {
  if (loading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 1 }} />
      </Card>
    );
  }

  return (
    <Card
      hoverable={hoverable || !!onClick}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <Statistic {...statisticProps} />
    </Card>
  );
};

export default StatisticCard;
