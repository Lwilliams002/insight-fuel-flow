import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Mountain, LogOut, ArrowLeft } from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  showBack?: boolean;
}

export function AdminLayout({ children, title, showBack = true }: AdminLayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const isMainDashboard = location.pathname === '/admin';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg safe-area-header">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {showBack && !isMainDashboard && (
              <Link to="/admin">
                <Button variant="ghost" size="icon" className="mr-1">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
            )}
            <Mountain className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
