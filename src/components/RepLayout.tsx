import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AwsAuthContext';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { LogOut } from 'lucide-react';
import { BottomNav } from './BottomNav';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface RepLayoutProps {
  children: ReactNode;
  title: string;
}

export function RepLayout({ children, title }: RepLayoutProps) {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-lg safe-area-header">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <BottomNav />
    </div>
  );
}
