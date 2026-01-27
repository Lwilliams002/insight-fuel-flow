import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AwsAuthContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Users,
  Home,
  DollarSign,
  FileSpreadsheet,
  Settings,
  LogOut,
  LayoutDashboard,
  Menu,
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
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
];

export function AdminMobileNav() {
  const { signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card/95 backdrop-blur-lg px-4 safe-area-header">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="font-semibold text-foreground">RoofCommission</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <Logo size="sm" />
                    <span className="font-semibold text-foreground">RoofCommission</span>
                  </div>
                </div>
                <nav className="flex-1 p-3 space-y-1">
                  {navItems.map((item) => (
                    <Link key={item.href} to={item.href} onClick={() => setOpen(false)}>
                      <Button
                        variant={isActive(item.href) ? 'secondary' : 'ghost'}
                        className={cn(
                          'w-full justify-start gap-3 h-12',
                          isActive(item.href) && 'bg-primary/10 text-primary border border-primary/20'
                        )}
                      >
                        <item.icon className={cn('h-5 w-5', isActive(item.href) && 'text-primary')} />
                        <span>{item.label}</span>
                      </Button>
                    </Link>
                  ))}
                </nav>
                <div className="p-3 border-t border-border">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={signOut}
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Sign Out</span>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {navItems.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors',
                isActive(item.href)
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
