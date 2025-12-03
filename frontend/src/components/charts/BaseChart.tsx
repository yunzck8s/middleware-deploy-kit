import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Spin } from 'antd';

export interface BaseChartProps {
  option: EChartsOption;
  loading?: boolean;
  height?: number | string;
  className?: string;
}

/**
 * 基础图表组件
 * 封装 ECharts，提供统一的配置和加载状态
 */
const BaseChart: React.FC<BaseChartProps> = ({
  option,
  loading = false,
  height = 400,
  className,
}) => {
  if (loading) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" tip="加载图表中..." />
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      className={className}
      opts={{
        renderer: 'svg', // 使用 SVG 渲染，性能更好
        locale: 'ZH',    // 中文
      }}
      notMerge={true}    // 不合并数据，直接替换
      lazyUpdate={true}  // 延迟更新，提升性能
    />
  );
};

export default BaseChart;
