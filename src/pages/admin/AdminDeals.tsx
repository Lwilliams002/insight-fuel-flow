import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminShell } from '@/components/AdminShell';
import { DealsTable } from '@/components/crm/DealsTable';
import { DealsKanban } from '@/components/crm/DealsKanban';
import { DealWizard } from '@/components/crm/DealWizard';
import { DealDetailSheet } from '@/components/crm/DealDetailSheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutList, Columns3, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ViewMode = 'table' | 'kanban';

export default function AdminDeals() {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<any | null>(null);
  const [repFilter, setRepFilter] = useState<string>('all');

  // Fetch all deals with commission info
  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          deal_commissions (
            id,
            commission_type,
            commission_percent,
            commission_amount,
            paid,
            rep_id,
            reps:rep_id (
              id,
              user_id,
              profiles:user_id (full_name, email)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch all reps for filter
  const { data: allReps } = useQuery({
    queryKey: ['all-reps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reps')
        .select(`
          id,
          user_id,
          profiles:user_id (full_name, email)
        `);
      if (error) throw error;
      return data;
    },
  });

  const handleViewDeal = (deal: any) => {
    setSelectedDeal(deal);
  };

  // Filter deals by rep
  const filteredDeals = deals?.filter((deal) => {
    if (repFilter === 'all') return true;
    return deal.deal_commissions?.some((c: any) => c.rep_id === repFilter);
  }) || [];

  // Calculate stats
  const totalValue = filteredDeals.reduce((sum, deal) => sum + (deal.total_price || 0), 0);
  const signedDeals = filteredDeals.filter((d) => d.status !== 'lead' && d.status !== 'cancelled').length;

  return (
    <AdminShell>
      <div className="flex flex-col h-full p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">CRM - All Deals</h1>
            <p className="text-muted-foreground text-sm">
              Manage all deals across your team
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Rep Filter */}
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="w-[200px]">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by rep" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                {allReps?.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {(rep.profiles as any)?.full_name || (rep.profiles as any)?.email || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="table" className="gap-1.5">
                  <LayoutList className="w-4 h-4" />
                  Table
                </TabsTrigger>
                <TabsTrigger value="kanban" className="gap-1.5">
                  <Columns3 className="w-4 h-4" />
                  Kanban
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button onClick={() => setWizardOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Deal
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Total Deals</p>
            <p className="text-2xl font-bold">{filteredDeals.length}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Signed Deals</p>
            <p className="text-2xl font-bold">{signedDeals}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Pipeline Value</p>
            <p className="text-2xl font-bold text-primary">${totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Active Reps</p>
            <p className="text-2xl font-bold">{allReps?.length || 0}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : viewMode === 'table' ? (
            <DealsTable deals={filteredDeals} onViewDeal={handleViewDeal} isAdmin />
          ) : (
            <DealsKanban deals={filteredDeals} onViewDeal={handleViewDeal} isAdmin />
          )}
        </div>
      </div>

      {/* Deal Wizard */}
      <DealWizard open={wizardOpen} onOpenChange={setWizardOpen} isAdmin />

      {/* Deal Detail Sheet - Using shared component for full functionality */}
      <DealDetailSheet
        deal={selectedDeal}
        isOpen={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
      />
    </AdminShell>
  );
}
