import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RepLayout } from '@/components/RepLayout';
import { KPICard } from '@/components/KPICard';
import { PayoutChart } from '@/components/PayoutChart';
import { AccountCard } from '@/components/AccountCard';
import { NotificationStatus } from '@/components/NotificationPrompt';
import { DollarSign, Building2, Users, Calendar, TrendingUp, Target } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { pinsApi } from '@/integrations/aws/api';
import { useAuth } from '@/contexts/AwsAuthContext';
import { format, isToday, startOfWeek, endOfWeek, subDays } from 'date-fns';

export default function RepDashboard() {
  const { user } = useAuth();

  // Generate month options - since payouts are on the 30th, "current" payout is for last month
  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    // Start from last month (current payout period)
    for (let i = 1; i <= 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  };

  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || '');

  // Fetch payout data for selected month
  const { data: payoutData, isLoading: isPayoutLoading } = useQuery({
    queryKey: ['rep-payouts', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payout_rows')
        .select(`
          id,
          month,
          profit,
          percent_used,
          payout_amount,
          merchant:merchants(id, name)
        `)
        .eq('month', selectedMonth);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedMonth,
  });

  // Fetch historical payouts for chart (last 6 months)
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['rep-payout-history'],
    queryFn: async () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const startMonth = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('payout_rows')
        .select('month, payout_amount')
        .gte('month', startMonth)
        .order('month');

      if (error) throw error;

      // Aggregate by month
      const monthlyTotals = new Map<string, number>();
      data?.forEach(row => {
        const current = monthlyTotals.get(row.month) || 0;
        monthlyTotals.set(row.month, current + Number(row.payout_amount));
      });

      // Convert to chart format
      return Array.from(monthlyTotals.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, payout]) => {
          const [year, monthNum] = month.split('-');
          const date = new Date(parseInt(year), parseInt(monthNum) - 1);
          return {
            month: date.toLocaleDateString('en-US', { month: 'short' }),
            payout: Number(payout.toFixed(2)),
          };
        });
    },
  });

  // Fetch rep's pins/leads data
  const { data: pinsData, isLoading: isPinsLoading } = useQuery({
    queryKey: ['rep-pins-dashboard'],
    queryFn: async () => {
      const response = await pinsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
    staleTime: 30000,
  });

  // Fetch appointments where current rep is assigned as closer
  const { data: closerAppointments, isLoading: isAppointmentsLoading } = useQuery({
    queryKey: ['closer-appointments-dashboard', user?.sub],
    queryFn: async () => {
      if (!user?.sub) return [];
      const response = await pinsApi.list();
      if (response.error) throw new Error(response.error);
      return (response.data || [])
        .filter(pin => pin.assigned_closer_id === user.sub && pin.status === "appointment")
        .sort((a, b) => {
          if (!a.appointment_date || !b.appointment_date) return 0;
          return new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime();
        });
    },
    enabled: !!user?.sub,
    staleTime: 30000,
  });

  // Calculate totals for selected month
  const totalPayout = useMemo(() => {
    return payoutData?.reduce((sum, row) => sum + Number(row.payout_amount), 0) || 0;
  }, [payoutData]);

  const activeAccounts = useMemo(() => {
    return payoutData?.filter(row => Number(row.payout_amount) > 0).length || 0;
  }, [payoutData]);

  // Format accounts for display
  const accounts = useMemo(() => {
    return payoutData?.map(row => ({
      merchantName: row.merchant?.name || 'Unknown Merchant',
      profit: Number(row.profit),
      repPercent: Number(row.percent_used),
      payoutAmount: Number(row.payout_amount),
    })) || [];
  }, [payoutData]);

  // Calculate lead generation stats
  const leadStats = useMemo(() => {
    if (!pinsData) return { totalLeads: 0, todayAppointments: 0, thisWeekAppointments: 0, installedCount: 0, conversionRate: 0 };

    const totalLeads = pinsData.length;
    const installedCount = pinsData.filter(pin => pin.status === 'installed').length;
    const conversionRate = totalLeads > 0 ? Math.round((installedCount / totalLeads) * 100) : 0;

    // Appointments for today and this week
    const todayAppointments = (closerAppointments || []).filter(pin =>
      pin.appointment_date && isToday(new Date(pin.appointment_date))
    ).length;

    const weekStart = startOfWeek(new Date());
    const weekEnd = endOfWeek(new Date());
    const thisWeekAppointments = (closerAppointments || []).filter(pin => {
      if (!pin.appointment_date) return false;
      const apptDate = new Date(pin.appointment_date);
      return apptDate >= weekStart && apptDate <= weekEnd;
    }).length;

    return { totalLeads, todayAppointments, thisWeekAppointments, installedCount, conversionRate };
  }, [pinsData, closerAppointments]);

  // Recent activity (last 7 days)
  const recentActivity = useMemo(() => {
    if (!pinsData) return [];
    const sevenDaysAgo = subDays(new Date(), 7);
    return pinsData
      .filter(pin => new Date(pin.created_at) >= sevenDaysAgo)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [pinsData]);

  // Get current selected month label for display
  const selectedMonthLabel = monthOptions.find(opt => opt.value === selectedMonth)?.label || '';

  return (
    <RepLayout title="Dashboard">
      <div className="space-y-4 p-4">
        {/* Notification Settings */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Notifications</h2>
          <NotificationStatus />
        </div>

        {/* Lead Generation KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          {isPinsLoading || isAppointmentsLoading ? (
            <>
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </>
          ) : (
            <>
              <KPICard
                title="Total Leads"
                value={leadStats.totalLeads.toString()}
                icon={Users}
              />
              <KPICard
                title="Today"
                value={leadStats.todayAppointments.toString()}
                icon={Calendar}
              />
              <KPICard
                title="This Week"
                value={leadStats.thisWeekAppointments.toString()}
                icon={TrendingUp}
              />
              <KPICard
                title="Conversion"
                value={`${leadStats.conversionRate}%`}
                icon={Target}
              />
            </>
          )}
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Recent Activity</h2>
          {isPinsLoading ? (
            <>
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </>
          ) : recentActivity.length === 0 ? (
            <div className="rounded-lg border bg-card p-4 text-center text-muted-foreground">
              No recent activity
            </div>
          ) : (
            recentActivity.map((pin, index) => (
              <div key={pin.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {pin.homeowner_name || "Unknown"} - {pin.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(pin.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {pin.address ? pin.address.split(',')[0] : 'No address'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Month Selector */}
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          {isPayoutLoading ? (
            <>
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </>
          ) : (
            <>
              <KPICard
                title="Last Month Earnings"
                value={`$${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={DollarSign}
              />
              <KPICard
                title="Active Accounts"
                value={activeAccounts.toString()}
                icon={Building2}
              />
            </>
          )}
        </div>

        {/* Trend Chart */}
        {isChartLoading ? (
          <Skeleton className="h-48 rounded-lg" />
        ) : chartData && chartData.length > 0 ? (
          <PayoutChart data={chartData} />
        ) : (
          <div className="rounded-lg border bg-card p-4 text-center text-muted-foreground">
            No payout history yet
          </div>
        )}

        {/* Account List */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Account Breakdown</h2>
          {isPayoutLoading ? (
            <>
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </>
          ) : accounts.length === 0 ? (
            <div className="rounded-lg border bg-card p-4 text-center text-muted-foreground">
              No payouts for {selectedMonthLabel}
            </div>
          ) : (
            accounts.map((account, index) => (
              <AccountCard key={index} {...account} showProfit />
            ))
          )}
        </div>
      </div>
    </RepLayout>
  );
}
