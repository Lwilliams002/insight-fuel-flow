import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Home, FileText, DollarSign, ClipboardList, LogOut, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

const adminTiles = [
  { href: '/admin/reps', icon: Users, label: 'Reps', desc: 'Manage sales reps' },
  { href: '/admin/deals', icon: Home, label: 'Deals', desc: 'All roofing deals' },
  { href: '/admin/commissions', icon: DollarSign, label: 'Commissions', desc: 'Manage payouts' },
  { href: '/admin/jotform', icon: ClipboardList, label: 'New Deal', desc: 'Submit via JotForm' },
  { href: '/admin/reports', icon: FileSpreadsheet, label: 'Reports', desc: 'Export data' },
];

export default function AdminDashboard() {
  const { signOut } = useAuth();

  // Fetch summary stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const [dealsResult, commissionsResult] = await Promise.all([
        supabase.from('deals').select('total_price, status'),
        supabase.from('deal_commissions').select('commission_amount, paid'),
      ]);

      const deals = dealsResult.data || [];
      const commissions = commissionsResult.data || [];

      const totalRevenue = deals.reduce((sum, d) => sum + Number(d.total_price || 0), 0);
      const pendingCommissions = commissions
        .filter(c => !c.paid)
        .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);
      const activeDeals = deals.filter(d => !['paid', 'cancelled'].includes(d.status)).length;

      return { totalRevenue, pendingCommissions, activeDeals };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg safe-area-header">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">RoofCommission Pro</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          {isLoading ? (
            <>
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </>
          ) : (
            <>
              <Card className="shadow-sm">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-lg font-bold">${(stats?.totalRevenue || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Pending Comm.</p>
                  <p className="text-lg font-bold">${(stats?.pendingCommissions || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Active Deals</p>
                  <p className="text-lg font-bold">{stats?.activeDeals || 0}</p>
                </CardContent>
              </Card>
            </>
          )}
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
