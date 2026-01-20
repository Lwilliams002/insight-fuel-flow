import { ReactNode } from 'react';
import { AdminShell } from './AdminShell';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  showBack?: boolean;
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        </div>
        {children}
      </div>
    </AdminShell>
  );
}
