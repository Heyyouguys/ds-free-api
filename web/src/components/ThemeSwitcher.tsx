import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemePreference } from '@/lib/theme';

const themeConfig = {
  system: { icon: Monitor, labelKey: 'theme.system' },
  light: { icon: Sun, labelKey: 'theme.light' },
  dark: { icon: Moon, labelKey: 'theme.dark' },
} as const;

interface ThemeSwitcherProps {
  className?: string;
  variant?: 'ghost' | 'outline' | 'default';
  showLabel?: boolean;
}

export function ThemeSwitcher({ className, variant = 'ghost', showLabel = true }: ThemeSwitcherProps = {}) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const nextTheme: ThemePreference = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
  const { icon: Icon, labelKey } = themeConfig[theme];

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => setTheme(nextTheme)}
      className={cn('justify-center sm:justify-start gap-1.5 sm:gap-2 text-muted-foreground px-2.5 sm:px-3 shrink-0', className)}
      title={t('theme.toggle')}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn(showLabel ? 'hidden sm:inline' : 'hidden')}>{t(labelKey)}</span>
    </Button>
  );
}
