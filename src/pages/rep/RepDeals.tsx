import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RepLayout } from '@/components/RepLayout';
import { DealsTable } from '@/components/crm/DealsTable';
import { DealsKanban } from '@/components/crm/DealsKanban';
import { DealWizard } from '@/components/crm/DealWizard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutList, Columns3 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

type ViewMode = 'table' | 'kanban';

export default function RepDeals() {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<any | null>(null);

  // Fetch deals for this rep (via deal_commissions)
  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals', 'rep'],
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
            rep_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleViewDeal = (deal: any) => {
    setSelectedDeal(deal);
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    lead: { label: 'Lead', color: 'bg-slate-500' },
    signed: { label: 'Signed', color: 'bg-blue-500' },
    permit: { label: 'Permit', color: 'bg-yellow-500' },
    install_scheduled: { label: 'Scheduled', color: 'bg-orange-500' },
    installed: { label: 'Installed', color: 'bg-teal-500' },
    complete: { label: 'Complete', color: 'bg-green-500' },
    paid: { label: 'Paid', color: 'bg-emerald-600' },
    cancelled: { label: 'Cancelled', color: 'bg-destructive' },
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
      <Sheet open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Deal Details</SheetTitle>
          </SheetHeader>

          {selectedDeal && (
            <div className="mt-6 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${statusConfig[selectedDeal.status]?.color}`} />
                <Badge variant="outline">{statusConfig[selectedDeal.status]?.label}</Badge>
                {selectedDeal.contract_signed && (
                  <Badge variant="secondary">Contract Signed</Badge>
                )}
              </div>

              {/* Homeowner Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Homeowner</h3>
                <div className="space-y-2">
                  <p className="font-medium">{selectedDeal.homeowner_name}</p>
                  {selectedDeal.homeowner_phone && (
                    <p className="text-sm text-muted-foreground">{selectedDeal.homeowner_phone}</p>
                  )}
                  {selectedDeal.homeowner_email && (
                    <p className="text-sm text-muted-foreground">{selectedDeal.homeowner_email}</p>
                  )}
                </div>
              </div>

              {/* Property */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Property</h3>
                <div>
                  <p className="font-medium">{selectedDeal.address}</p>
                  <p className="text-sm text-muted-foreground">
                    {[selectedDeal.city, selectedDeal.state, selectedDeal.zip_code].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>

              {/* Deal Value */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Value</h3>
                <p className="text-2xl font-bold text-primary">
                  ${selectedDeal.total_price?.toLocaleString() || '0'}
                </p>
              </div>

              {/* Commissions */}
              {selectedDeal.deal_commissions?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Commissions</h3>
                  <div className="space-y-2">
                    {selectedDeal.deal_commissions.map((comm: any) => (
                      <div key={comm.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium capitalize">{comm.commission_type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">{comm.commission_percent}%</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${comm.commission_amount.toLocaleString()}</p>
                          <Badge variant={comm.paid ? 'default' : 'secondary'} className="text-xs">
                            {comm.paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedDeal.notes && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Notes</h3>
                  <p className="text-sm">{selectedDeal.notes}</p>
                </div>
              )}

              {/* Dates */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{format(new Date(selectedDeal.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  {selectedDeal.signed_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signed</span>
                      <span>{format(new Date(selectedDeal.signed_date), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {selectedDeal.install_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Install</span>
                      <span>{format(new Date(selectedDeal.install_date), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {selectedDeal.completion_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed</span>
                      <span>{format(new Date(selectedDeal.completion_date), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </RepLayout>
  );
}
