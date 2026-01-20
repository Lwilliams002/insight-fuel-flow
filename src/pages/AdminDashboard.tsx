import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminShell } from '@/components/AdminShell';
import { StatCard } from '@/components/StatCard';
import { QuickAction } from '@/components/QuickAction';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, 
  TrendingUp, 
  Home, 
  Users, 
  ClipboardList, 
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export default function AdminDashboard() {
  // Fetch summary stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const [dealsResult, commissionsResult, repsResult] = await Promise.all([
        supabase.from('deals').select('total_price, status, created_at'),
        supabase.from('deal_commissions').select('commission_amount, paid'),
        supabase.from('reps').select('id'),
      ]);

      const deals = dealsResult.data || [];
      const commissions = commissionsResult.data || [];
      const reps = repsResult.data || [];

      const totalRevenue = deals.reduce((sum, d) => sum + Number(d.total_price || 0), 0);
      const pendingCommissions = commissions
        .filter(c => !c.paid)
        .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);
      const activeDeals = deals.filter(d => !['paid', 'cancelled'].includes(d.status)).length;
      const completedDeals = deals.filter(d => ['paid', 'complete'].includes(d.status)).length;
      const totalReps = reps.length;

      return { totalRevenue, pendingCommissions, activeDeals, completedDeals, totalReps };
    },
  });

  return (
    <AdminShell>
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your business overview.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </>
          ) : (
            <>
              <StatCard
                title="Total Revenue"
                value={`$${(stats?.totalRevenue || 0).toLocaleString()}`}
                icon={DollarSign}
                variant="primary"
              />
              <StatCard
                title="Pending Commissions"
                value={`$${(stats?.pendingCommissions || 0).toLocaleString()}`}
                icon={AlertCircle}
                variant="accent"
              />
              <StatCard
                title="Active Deals"
                value={stats?.activeDeals || 0}
                icon={TrendingUp}
              />
              <StatCard
                title="Completed Deals"
                value={stats?.completedDeals || 0}
                icon={CheckCircle}
              />
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAction
              href="/admin/jotform"
              icon={ClipboardList}
              label="New Deal"
              description="Submit a new roofing deal"
              variant="primary"
            />
            <QuickAction
              href="/admin/deals"
              icon={Home}
              label="Manage Deals"
              description="View and update all deals"
            />
            <QuickAction
              href="/admin/reps"
              icon={Users}
              label="Manage Reps"
              description="Add or edit sales representatives"
            />
            <QuickAction
              href="/admin/commissions"
              icon={DollarSign}
              label="Commissions"
              description="Review and pay commissions"
              variant="accent"
            />
            <QuickAction
              href="/admin/reports"
              icon={FileSpreadsheet}
              label="Reports"
              description="Export data and analytics"
            />
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-3">Team Overview</h3>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.totalReps || 0}</p>
                <p className="text-sm text-muted-foreground">Active Sales Reps</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-3">Deal Pipeline</h3>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.activeDeals || 0}</p>
                <p className="text-sm text-muted-foreground">Deals in Progress</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
