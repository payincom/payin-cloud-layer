import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Link2,
  ShoppingCart,
  Landmark,
  Database,
  Settings,
  Key,
  CloudCog,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  User,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';

const resolveInitialTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const savedTheme = window.localStorage.getItem('theme') as 'light' | 'dark' | null;
  const initialTheme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';

  document.documentElement.classList.toggle('dark', initialTheme === 'dark');

  return initialTheme;
};

const resolveInitialSidebarState = (): boolean => {
  if (typeof window === 'undefined') {
    return false; // Default to expanded
  }

  const savedState = window.localStorage.getItem('sidebarCollapsed');
  return savedState === 'true'; // Return true if explicitly set to 'true', otherwise false (expanded)
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, organization, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(resolveInitialSidebarState); // Load from localStorage, default to expanded
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(resolveInitialTheme);

  const isSuperAdmin = user?.isSuperadmin === true;
  const orgRole = organization?.role;
  const canManageOrgConfig = orgRole === 'owner' || orgRole === 'admin';
  const canAccessConfig = isSuperAdmin || canManageOrgConfig;

  // 同步主题到 DOM 和 localStorage
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  // 同步侧边栏状态到 localStorage
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // 切换主题
  const toggleTheme = () => {
    setTheme(currentTheme => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  // 登出处理
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Payment Links', path: '/payment-links', icon: Link2 },
    { name: 'Orders', path: '/orders', icon: ShoppingCart },
    { name: 'Deposits', path: '/deposits', icon: Landmark },
    { name: 'Address Pool', path: '/address-pool', icon: Database },
    ...(canAccessConfig ? [{ name: 'Configuration', path: '/config', icon: Settings }] : []),
    { name: 'Cloud Layer', path: '/cloud-layer/control-plane', icon: CloudCog },
  ] as const;

  const currentPage = navigation.find((item) => {
    if (item.path === '/config') {
      return location.pathname === '/config' || location.pathname.startsWith('/config');
    }
    return item.path === location.pathname;
  }) || (location.pathname === '/api-keys' ? { name: 'API Keys', path: '/api-keys', icon: Key } : null);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className={`flex items-center h-16 border-b border-border relative ${sidebarCollapsed ? '' : 'px-4'}`}>
          {!sidebarCollapsed && (
            <span className="text-xl font-semibold font-brand text-muted-foreground whitespace-nowrap absolute left-6">
              PayIn
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSidebarCollapsed(!sidebarCollapsed);
              setMobileSidebarOpen(false);
            }}
            className={`hidden lg:flex hover:bg-accent ${sidebarCollapsed ? 'mx-auto' : 'ml-auto'}`}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-foreground" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = item.path === '/config'
              ? location.pathname === '/config' || location.pathname.startsWith('/config')
              : location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors
                  ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }
                  ${sidebarCollapsed ? 'justify-center' : ''}
                `}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Menu */}
        <div className="p-3 border-t border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`w-full hover:bg-accent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none focus:ring-0 focus:outline-none ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start'}`}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                {!sidebarCollapsed && (
                  <span className="ml-3 text-sm font-medium text-foreground flex-1 text-left">
                    {user?.username || 'User'}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-2">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-foreground">{user?.username}</p>
                  {user?.role && (
                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/api-keys')} className="cursor-pointer">
                <Key className="mr-2 h-4 w-4" />
                <span>API Keys</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                {theme === 'dark' ? (
                  <>
                    <Sun className="mr-2 h-4 w-4" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    <span>Dark Mode</span>
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}
        `}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-card border-b border-border">
          <div className="flex items-center justify-between h-full px-4 lg:px-8">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden"
              >
                <Menu className="w-5 h-5 text-foreground" />
              </Button>
              <div className="flex items-center gap-3">
                {currentPage && (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <currentPage.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        {currentPage.name}
                      </h2>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right section with Organization Switcher */}
            <div className="flex items-center gap-2">
              <OrganizationSwitcher />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
