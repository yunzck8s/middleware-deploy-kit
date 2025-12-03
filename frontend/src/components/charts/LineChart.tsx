import React from 'react';
import BaseChart from './BaseChart';
import type { EChartsOption } from 'echarts';

export interface LineChartDataItem {
  name: string;
  data: number[];
  color?: string;
}

export interface LineChartProps {
  data: LineChartDataItem[];
  xAxisData: string[];
  title?: string;
  loading?: boolean;
  height?: number;
  smooth?: boolean;
  showArea?: boolean;
}

/**
 * 折线图组件
 * 用于展示趋势数据，如部署趋势等
 */
const LineChart: React.FC<LineChartProps> = ({
  data,
  xAxisData,
  title,
  loading = false,
  height = 400,
  smooth = true,
  showArea = true,
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
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    legend: {
      data: data.map((item) => item.name),
      bottom: 10,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData,
    },
    yAxis: {
      type: 'value',
      minInterval: 1, // 最小间隔为1，避免小数
    },
    series: data.map((item) => ({
      name: item.name,
      type: 'line',
      smooth,
      data: item.data,
      itemStyle: item.color ? { color: item.color } : undefined,
      areaStyle: showArea
        ? {
            opacity: 0.2,
          }
        : undefined,
      emphasis: {
        focus: 'series',
      },
    })),
  };

  return <BaseChart option={option} loading={loading} height={height} />;
};

export default LineChart;
