import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RepLayout } from '@/components/RepLayout';
import { KPICard } from '@/components/KPICard';
import { PayoutChart } from '@/components/PayoutChart';
import { AccountCard } from '@/components/AccountCard';
import { DollarSign, Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

export default function RepDashboard() {
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

  // Get current selected month label for display
  const selectedMonthLabel = monthOptions.find(opt => opt.value === selectedMonth)?.label || '';

  return (
    <RepLayout title="Dashboard">
      <div className="space-y-4 p-4">
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          {isPayoutLoading ? (
            <>
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </>
          ) : (
            <>
              <KPICard
                title="Last Month"
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
