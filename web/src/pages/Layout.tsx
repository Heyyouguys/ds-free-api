import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { UserDropdown } from '@/components/UserDropdown';
import {
  LayoutDashboard,
  Boxes,
  Sliders,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const SIDEBAR_STORAGE_KEY = 'ds-sidebar-collapsed';

export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();

  // Desktop sidebar collapse state with localStorage persistence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  };

  // Desktop & Tablet Sidebar Navigation: Dashboard, Models, Config, Logs
  const desktopNavItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/models', icon: Boxes, label: t('nav.models') },
    { to: '/config', icon: Sliders, label: t('nav.config') },
    { to: '/logs', icon: ScrollText, label: t('nav.logs') },
  ];

  // Mobile Bottom Tab Bar Navigation: Core 3 views (Logs and Settings are inside Profile Dropdown)
  const mobileNavItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/models', icon: Boxes, label: t('nav.models') },
    { to: '/config', icon: Sliders, label: t('nav.config') },
  ];

  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col md:flex-row bg-background">
      {/* ── Desktop & Tablet Sidebar (Tablet is always w-16; Desktop toggles w-16 or w-64) ── */}
      <aside
        className={cn(
          'hidden md:flex flex-col h-full border-r bg-card shrink-0 justify-between select-none transition-[width] duration-300 ease-in-out',
          isSidebarCollapsed ? 'w-16' : 'w-16 lg:w-64'
        )}
      >
        {/* Top Header Branding & Toggle Button */}
        <div>
          <div
            className={cn(
              'p-3 flex items-center transition-all',
              isSidebarCollapsed
                ? 'justify-center flex-col gap-2 py-3'
                : 'justify-center lg:justify-between lg:p-4'
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/admin/favicon.svg" alt="Logo" className="h-7 w-7 shrink-0" />
              {!isSidebarCollapsed && (
                <div className="hidden lg:flex flex-col min-w-0">
                  <span className="font-bold text-base leading-none tracking-tight truncate">DS Free API</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">v0.2.6</span>
                </div>
              )}
            </div>

            {/* Desktop Minimize/Maximize Button */}
            <button
              type="button"
              onClick={toggleSidebar}
              className={cn(
                'hidden lg:flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSidebarCollapsed ? 'w-8 h-8' : 'h-7 w-7'
              )}
              title={isSidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
              aria-label={isSidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>
          <Separator />

          {/* Navigation Links */}
          <nav className="p-2 space-y-1" aria-label="Main Navigation">
            {desktopNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                title={label}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-lg text-sm font-medium transition-all group',
                    isSidebarCollapsed
                      ? 'justify-center px-2 py-2.5'
                      : 'justify-center lg:justify-start lg:gap-3 px-2 lg:px-3 py-2.5 lg:py-2',
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )
                }
              >
                <Icon className={cn('h-5 w-5 shrink-0', !isSidebarCollapsed && 'lg:h-4 lg:w-4')} />
                {!isSidebarCollapsed && (
                  <span className="hidden lg:inline truncate">{label}</span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer: Profile Dropdown */}
        <div className="p-2 lg:p-3 border-t bg-card/60 w-full flex items-center justify-center">
          <UserDropdown
            placement="bottom-up"
            showLogs={false}
            responsiveMinimized={!isSidebarCollapsed}
            isCollapsed={isSidebarCollapsed}
          />
        </div>
      </aside>

      {/* ── Mobile Top Header (Visible only on Mobile) ── */}
      <header className="flex md:hidden items-center justify-between px-4 h-14 border-b bg-card/95 backdrop-blur-md shrink-0 z-30 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/admin/favicon.svg" alt="Logo" className="h-6 w-6 shrink-0" />
          <span className="font-bold text-base tracking-tight truncate">DS Free API</span>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground shrink-0">v0.2.6</span>
        </div>
        {/* On Mobile, UserDropdown includes Logs & Settings */}
        <UserDropdown placement="top-down" compact={true} showLogs={true} />
      </header>

      {/* ── Main Scrollable Content Area with Smooth Route Fade ── */}
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 lg:p-6 pb-6 focus:outline-none relative">
        <div key={location.pathname} className="max-w-6xl mx-auto w-full animate-in fade-in-50 duration-200 ease-out">
          <Outlet context={{ isSidebarCollapsed }} />
        </div>
      </main>

      {/* ── Mobile Bottom Navigation Bar (Flex sibling, NOT fixed, prevents covering content) ── */}
      <nav
        className="flex md:hidden shrink-0 h-16 pb-[env(safe-area-inset-bottom,0px)] bg-card/95 backdrop-blur-md border-t z-30 items-center justify-around px-2 select-none"
        aria-label="Mobile Bottom Navigation"
      >
        {mobileNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 w-full h-full py-1 text-[11px] font-medium transition-colors active:scale-95',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'flex items-center justify-center h-7 w-12 rounded-full transition-colors',
                    isActive ? 'bg-primary/15' : 'bg-transparent'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="truncate max-w-[80px]">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
