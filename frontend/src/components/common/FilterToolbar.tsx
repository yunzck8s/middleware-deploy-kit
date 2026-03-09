import type { ReactNode } from 'react';

interface FilterToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
}

const FilterToolbar = ({ left, right }: FilterToolbarProps) => {
  return (
    <div className="filter-toolbar">
      <div className="filter-toolbar__left">{left}</div>
      <div className="filter-toolbar__right">{right}</div>
    </div>
  );
};

export default FilterToolbar;
