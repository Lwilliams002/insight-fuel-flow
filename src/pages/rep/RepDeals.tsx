import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dealsApi, Deal } from '@/integrations/aws/api';
import { RepLayout } from '@/components/RepLayout';
import { DealsTable } from '@/components/crm/DealsTable';
import { DealsKanban } from '@/components/crm/DealsKanban';
import { DealWizard } from '@/components/crm/DealWizard';
import { DealDetailSheet } from '@/components/crm/DealDetailSheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutList, Columns3 } from 'lucide-react';

type ViewMode = 'table' | 'kanban';

export default function RepDeals() {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Fetch deals for this rep (via deal_commissions)
  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals', 'rep'],
    queryFn: async () => {
      const response = await dealsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
  });

  const handleViewDeal = (deal: Deal) => {
    setSelectedDeal(deal);
  };

  return (
    <RepLayout title="My Deals">
      <div className="flex flex-col h-full p-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Deals</h1>
            <p className="text-muted-foreground text-sm">
              {deals?.length || 0} total deals
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* View Toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="table" className="gap-1.5">
                  <LayoutList className="w-4 h-4" />
                  <span className="hidden sm:inline">Table</span>
                </TabsTrigger>
                <TabsTrigger value="kanban" className="gap-1.5">
                  <Columns3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Kanban</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button onClick={() => setWizardOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              New Deal
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : viewMode === 'table' ? (
            <DealsTable deals={deals || []} onViewDeal={handleViewDeal} />
          ) : (
            <DealsKanban deals={deals || []} onViewDeal={handleViewDeal} />
          )}
        </div>
      </div>

      {/* Deal Wizard */}
      <DealWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Deal Detail Sheet */}
      <DealDetailSheet
        deal={selectedDeal}
        isOpen={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
      />
    </RepLayout>
  );
}
