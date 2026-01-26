import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AwsAuthContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import {
  Users,
  Home,
  DollarSign,
  FileSpreadsheet,
  Settings,
  LogOut,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/deals', icon: Home, label: 'Deals' },
  { href: '/admin/map', icon: MapPin, label: 'Map' },
  { href: '/admin/reps', icon: Users, label: 'Reps' },
  { href: '/admin/commissions', icon: DollarSign, label: 'Commissions' },
  { href: '/admin/reports', icon: FileSpreadsheet, label: 'Reports' },
];

const bottomItems = [
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
];

export function AdminSidebar() {
  const { signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside
      className={cn(
        'sticky top-0 h-screen flex flex-col bg-card border-r border-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center w-full')}>
          <Logo size="sm" />
          {!collapsed && (
            <span className="font-semibold text-foreground whitespace-nowrap">Titan Prime</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link key={item.href} to={item.href}>
            <Button
              variant={isActive(item.href) ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 h-11',
                isActive(item.href) && 'bg-primary/10 text-primary border border-primary/20',
                collapsed && 'justify-center px-0'
              )}
            >
              <item.icon className={cn('h-5 w-5 shrink-0', isActive(item.href) && 'text-primary')} />
              {!collapsed && <span>{item.label}</span>}
            </Button>
          </Link>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 space-y-1 border-t border-border">
        {bottomItems.map((item) => (
          <Link key={item.href} to={item.href}>
            <Button
              variant={isActive(item.href) ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 h-11',
                isActive(item.href) && 'bg-primary/10 text-primary border border-primary/20',
                collapsed && 'justify-center px-0'
              )}
            >
              <item.icon className={cn('h-5 w-5 shrink-0', isActive(item.href) && 'text-primary')} />
              {!collapsed && <span>{item.label}</span>}
            </Button>
          </Link>
        ))}
        
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 h-11 text-destructive hover:text-destructive hover:bg-destructive/10',
            collapsed && 'justify-center px-0'
          )}
          onClick={signOut}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </Button>

        {/* Collapse Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full mt-2', collapsed && 'px-0')}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
