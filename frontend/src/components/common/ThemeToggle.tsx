import { Button, Tooltip } from 'antd';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  compact?: boolean;
}

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const ThemeToggle = ({ compact = false }: ThemeToggleProps) => {
  const { isDark, toggleTheme } = useTheme();
  const nextLabel = isDark ? '切换到亮色模式' : '切换到暗色模式';
  const actionLabel = isDark ? '日间' : '夜间';

  return (
    <Tooltip title={nextLabel}>
      <Button
        type="text"
        className={`theme-toggle ${compact ? 'theme-toggle--compact' : ''}`.trim()}
        icon={isDark ? <SunIcon /> : <MoonIcon />}
        onClick={toggleTheme}
        aria-label={nextLabel}
      >
        {!compact && <span className="theme-toggle__label">{actionLabel}</span>}
      </Button>
    </Tooltip>
  );
};

export default ThemeToggle;
