import type { ReactNode } from 'react';
import { Card } from 'antd';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

const SectionCard = ({ title, subtitle, extra, children, className, bodyClassName }: SectionCardProps) => {
  return (
    <Card
      className={`section-card ${className ?? ''}`.trim()}
      styles={{ body: { padding: 0 } }}
      title={
        title || subtitle ? (
          <div className="section-card__header">
            <div>
              {title && <div className="section-card__title">{title}</div>}
              {subtitle && <div className="section-card__subtitle">{subtitle}</div>}
            </div>
          </div>
        ) : undefined
      }
      extra={extra}
    >
      <div className={`section-card__body ${bodyClassName ?? ''}`.trim()}>{children}</div>
    </Card>
  );
};

export default SectionCard;
