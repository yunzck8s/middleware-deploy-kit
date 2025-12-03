import React from 'react';
import { Segmented } from 'antd';
import { TableOutlined, AppstoreOutlined } from '@ant-design/icons';

export type ViewMode = 'table' | 'card';

export interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

/**
 * 视图切换组件
 * 在表格视图和卡片视图之间切换
 */
const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ value, onChange }) => {
  return (
    <Segmented
      value={value}
      onChange={(val) => onChange(val as ViewMode)}
      options={[
        {
          label: '表格',
          value: 'table',
          icon: <TableOutlined />,
        },
        {
          label: '卡片',
          value: 'card',
          icon: <AppstoreOutlined />,
        },
      ]}
    />
  );
};

export default ViewSwitcher;
