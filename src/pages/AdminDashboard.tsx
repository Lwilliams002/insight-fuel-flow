import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Building2, Upload, FileCheck, Lock, FileText, LogOut, Mountain, FolderUp } from 'lucide-react';

const adminTiles = [
  { href: '/admin/reps', icon: Users, label: 'Reps', desc: 'Manage sales reps' },
  { href: '/admin/merchants', icon: Building2, label: 'Merchants', desc: 'Manage merchants' },
  { href: '/admin/upload', icon: Upload, label: 'Statements', desc: 'Upload statements' },
  { href: '/admin/accounts-upload', icon: FolderUp, label: 'Accounts', desc: 'Bulk import accounts' },
  { href: '/admin/review', icon: FileCheck, label: 'Review', desc: 'Match accounts' },
  { href: '/admin/approve', icon: Lock, label: 'Approve', desc: 'Lock months' },
  { href: '/admin/reports', icon: FileText, label: 'Reports', desc: 'Export data' },
];

export default function AdminDashboard() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg safe-area-header">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Mountain className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Admin Panel</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">$45,230</p>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">$5,428</p>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tiles */}
        <div className="grid grid-cols-2 gap-3">
          {adminTiles.map((tile) => (
            <Link key={tile.href} to={tile.href}>
              <Card className="shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                <CardContent className="flex flex-col items-center p-4 text-center">
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <tile.icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium text-foreground">{tile.label}</p>
                  <p className="text-xs text-muted-foreground">{tile.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
