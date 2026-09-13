import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/use-auth';
import { useTheme, type ThemePreference } from '@/lib/theme';
import {
  User,
  ChevronsUpDown,
  Languages,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Check,
  Settings,
  ScrollText,
  ChevronDown,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const languages = [
  { code: 'zh', labelKey: 'language.zh' },
  { code: 'en', labelKey: 'language.en' },
  { code: 'id', labelKey: 'language.id' },
] as const;

const themes = [
  { value: 'light' as ThemePreference, icon: Sun, labelKey: 'theme.light' },
  { value: 'dark' as ThemePreference, icon: Moon, labelKey: 'theme.dark' },
  { value: 'system' as ThemePreference, icon: Monitor, labelKey: 'theme.system' },
] as const;

interface UserDropdownProps {
  placement?: 'bottom-up' | 'top-down';
  compact?: boolean;
  showLogs?: boolean;
  responsiveMinimized?: boolean;
  isCollapsed?: boolean;
}

export function UserDropdown({
  placement = 'bottom-up',
  compact = false,
  showLogs = false,
  responsiveMinimized = false,
  isCollapsed = false,
}: UserDropdownProps) {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentLangCode = i18n.language?.startsWith('id')
    ? 'id'
    : i18n.language?.startsWith('en')
    ? 'en'
    : 'zh';

  const currentLangObj = languages.find((l) => l.code === currentLangCode) || languages[1];
  const currentThemeObj = themes.find((th) => th.value === theme) || themes[2];
  const CurrentThemeIcon = currentThemeObj.icon;

  const handleLogout = () => {
    setIsOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div className={cn('relative', !compact && 'w-full')} ref={containerRef}>
      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          role="menu"
          tabIndex={-1}
          aria-label="User Menu"
          className={cn(
            'absolute w-64 rounded-xl border bg-card/95 backdrop-blur-md p-1.5 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 z-50 animate-in fade-in-0 zoom-in-95',
            placement === 'bottom-up'
              ? isCollapsed
                ? 'bottom-0 left-full ml-2 origin-bottom-left'
                : 'bottom-full left-0 mb-2 origin-bottom'
              : 'top-full right-0 mt-2 origin-top-right'
          )}
        >
          {/* User Info Header */}
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20 shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground truncate">Admin</span>
              <span className="text-[11px] text-muted-foreground truncate">{t('profile.role')}</span>
            </div>
          </div>

          <Separator className="my-1" />

          {/* Navigation Links (Logs conditionally for mobile, Settings universally) */}
          <div className="space-y-0.5">
            {showLogs && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/logs');
                }}
                className="flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs font-medium text-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-left"
              >
                <ScrollText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{t('nav.logs')}</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                navigate('/settings');
              }}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs font-medium text-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-left"
            >
              <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{t('nav.settings')}</span>
            </button>
          </div>

          <Separator className="my-1" />

          {/* Accordion: Language Selection */}
          <div className="rounded-lg overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setLangOpen((prev) => !prev)}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <Languages className="h-3.5 w-3.5" />
                <span>{t('profile.language')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-foreground font-medium">{t(currentLangObj.labelKey)}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', langOpen && 'rotate-180')} />
              </div>
            </button>

            {langOpen && (
              <div className="px-1 py-1 space-y-0.5 bg-muted/30 rounded-lg mt-0.5">
                {languages.map(({ code, labelKey }) => {
                  const isActive = currentLangCode === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        i18n.changeLanguage(code);
                        setLangOpen(false);
                      }}
                      className={cn(
                        'flex items-center justify-between w-full px-2.5 py-1.5 text-xs rounded-md transition-colors text-left',
                        isActive
                          ? 'bg-primary text-primary-foreground font-medium shadow-2xs'
                          : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <span>{t(labelKey)}</span>
                      {isActive && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Accordion: Theme Selection */}
          <div className="rounded-lg overflow-hidden transition-all mt-0.5">
            <button
              type="button"
              onClick={() => setThemeOpen((prev) => !prev)}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <CurrentThemeIcon className="h-3.5 w-3.5" />
                <span>{t('profile.theme')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-foreground font-medium capitalize">{t(currentThemeObj.labelKey)}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', themeOpen && 'rotate-180')} />
              </div>
            </button>

            {themeOpen && (
              <div className="grid grid-cols-3 gap-1 p-1 bg-muted/30 rounded-lg mt-0.5">
                {themes.map(({ value, icon: Icon, labelKey }) => {
                  const isActive = theme === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setTheme(value);
                        setThemeOpen(false);
                      }}
                      className={cn(
                        'flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-md text-xs transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground font-medium shadow-2xs'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                      title={t(labelKey)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-[10px] leading-none">{t(labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Separator className="my-1" />

          {/* Logout Action */}
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs font-medium text-destructive rounded-lg hover:bg-destructive/10 transition-colors text-left"
          >
            <LogOut className="h-4 w-4" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      )}

      {/* Trigger Button: Responsive Minimized on Tablet (icon only on md, full on lg), Compact on Mobile Header */}
      {compact ? (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isOpen && 'bg-primary/20 ring-2 ring-primary/30'
          )}
          aria-label="User Profile and Settings"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <User className="h-4 w-4" />
        </button>
      ) : isCollapsed ? (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'flex items-center justify-center w-10 h-10 p-0 rounded-xl transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isOpen
              ? 'bg-accent text-accent-foreground shadow-2xs'
              : 'hover:bg-accent/80 hover:text-accent-foreground text-foreground'
          )}
          aria-label="User Profile and Settings"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title="Admin Profile & Settings"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20 shrink-0 group-hover:bg-primary/20 transition-colors">
            <User className="h-4 w-4" />
          </div>
        </button>
      ) : responsiveMinimized ? (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'flex items-center justify-center lg:justify-between w-10 h-10 lg:w-full lg:h-auto p-0 lg:px-3 lg:py-2.5 rounded-xl transition-colors text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isOpen
              ? 'bg-accent text-accent-foreground shadow-2xs'
              : 'hover:bg-accent/80 hover:text-accent-foreground text-foreground'
          )}
          aria-label="User Profile and Settings"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title="Admin Profile & Settings"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20 shrink-0 group-hover:bg-primary/20 transition-colors">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden lg:flex flex-col min-w-0">
              <span className="text-sm font-semibold leading-none truncate">Admin</span>
              <span className="text-[11px] text-muted-foreground truncate mt-1">
                {t('profile.role')}
              </span>
            </div>
          </div>
          <ChevronsUpDown className="hidden lg:inline h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors ml-2" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            'flex items-center gap-3 w-full p-2 rounded-lg transition-colors text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isOpen
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent hover:text-accent-foreground text-foreground'
          )}
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20 shrink-0 group-hover:bg-primary/20 transition-colors">
            <User className="h-4 w-4" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium leading-none truncate">Admin</span>
            <span className="text-[11px] text-muted-foreground truncate mt-1">
              {t('profile.role')}
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
        </button>
      )}
    </div>
  );
}
