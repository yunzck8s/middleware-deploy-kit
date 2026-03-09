import type { ReactNode } from 'react';

interface ActionGroupProps {
  children: ReactNode;
}

const ActionGroup = ({ children }: ActionGroupProps) => {
  return <div className="action-group">{children}</div>;
};

export default ActionGroup;
