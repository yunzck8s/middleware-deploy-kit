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
    backgroundColor: 'transparent',
    title: title
      ? {
          text: title,
          left: 'left',
          textStyle: {
            fontSize: 14,
            fontWeight: 700,
            color: '#F8FAFC',
          },
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0F172A',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      textStyle: {
        color: '#F8FAFC',
      },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: 'rgba(148, 163, 184, 0.24)',
        },
      },
    },
    legend: {
      data: data.map((item) => item.name),
      top: 0,
      right: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        color: '#94A3B8',
        fontSize: 12,
      },
    },
    grid: {
      left: '2%',
      right: '2%',
      top: 44,
      bottom: 24,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData,
      axisLine: {
        lineStyle: { color: 'rgba(148, 163, 184, 0.16)' },
      },
      axisLabel: {
        color: '#64748B',
        fontSize: 11,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: {
          color: 'rgba(148, 163, 184, 0.08)',
        },
      },
      axisLabel: {
        color: '#64748B',
        fontSize: 11,
      },
    },
    series: data.map((item) => ({
      name: item.name,
      type: 'line',
      smooth,
      data: item.data,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: {
        width: 3,
        color: item.color,
      },
      itemStyle: item.color ? { color: item.color } : undefined,
      areaStyle: showArea
        ? {
            opacity: 0.12,
            color: item.color,
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
