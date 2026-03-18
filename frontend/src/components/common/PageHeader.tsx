import type { ReactNode } from 'react';
import NotificationBell from './NotificationBell';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

const PageHeader = ({ title, subtitle, eyebrow, actions }: PageHeaderProps) => {
  return (
    <div className="page-header shell-reveal shell-reveal--hero">
      <div className="page-header__copy">
        {eyebrow && <span className="page-header__eyebrow">{eyebrow}</span>}
        <h2 className="page-header__title">{title}</h2>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      <div className="page-header__actions">
        {actions}
        <NotificationBell />
      </div>
    </div>
  );
};

export default PageHeader;
