import React from 'react';
import BaseChart from './BaseChart';
import type { EChartsOption } from 'echarts';

export interface PieChartDataItem {
  name: string;
  value: number;
  color?: string;
}

export interface PieChartProps {
  data: PieChartDataItem[];
  title?: string;
  loading?: boolean;
  height?: number;
  showPercentage?: boolean;
}

/**
 * 饼图组件
 * 用于展示状态分布，如部署状态分布等
 */
const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  loading = false,
  height = 400,
  showPercentage = true,
}) => {
  const option: EChartsOption = {
    title: title
      ? {
          text: title,
          left: 'center',
          textStyle: {
            fontSize: 16,
            fontWeight: 600,
          },
        }
      : undefined,
    tooltip: {
      trigger: 'item',
      formatter: showPercentage ? '{b}: {c} ({d}%)' : '{b}: {c}',
    },
    legend: {
      bottom: 10,
      left: 'center',
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'], // 环形饼图
        avoidLabelOverlap: false,
        label: {
          show: true,
          formatter: showPercentage ? '{b}\n{d}%' : '{b}\n{c}',
          fontSize: 12,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: true,
        },
        data: data.map((item) => ({
          name: item.name,
          value: item.value,
          itemStyle: item.color
            ? {
                color: item.color,
              }
            : undefined,
        })),
      },
    ],
  };

  return <BaseChart option={option} loading={loading} height={height} />;
};

export default PieChart;
