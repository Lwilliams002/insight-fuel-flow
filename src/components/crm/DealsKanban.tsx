import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { FileSignature, GripVertical } from 'lucide-react';

type DealStatus = 'lead' | 'signed' | 'permit' | 'install_scheduled' | 'installed' | 'complete' | 'paid' | 'cancelled';

interface Deal {
  id: string;
  homeowner_name: string;
  address: string;
  status: DealStatus;
  total_price: number;
  contract_signed: boolean | null;
  install_date: string | null;
  permit_file_url: string | null;
  install_images: string[] | null;
  completion_images: string[] | null;
  payment_requested: boolean | null;
}

interface DealsKanbanProps {
  deals: Deal[];
  onViewDeal: (deal: Deal) => void;
}

const columns: { id: DealStatus; title: string; color: string }[] = [
  { id: 'lead', title: 'Lead', color: 'bg-slate-500' },
  { id: 'signed', title: 'Signed', color: 'bg-blue-500' },
  { id: 'permit', title: 'Permit', color: 'bg-yellow-500' },
  { id: 'install_scheduled', title: 'Scheduled', color: 'bg-orange-500' },
  { id: 'installed', title: 'Installed', color: 'bg-teal-500' },
  { id: 'complete', title: 'Complete', color: 'bg-green-500' },
  { id: 'pending', title: 'Payment Pending', color: 'bg-amber-500' },
  { id: 'paid', title: 'Paid', color: 'bg-emerald-600' },
];

// Status requirements - what's needed to move to each status
const statusRequirements: Partial<Record<DealStatus, { check: (deal: Deal) => boolean; message: string }>> = {
  signed: {
    check: (deal) => deal.contract_signed === true,
    message: 'Contract must be signed before marking as Signed',
  },
  permit: {
    check: (deal) => !!deal.permit_file_url,
    message: 'Permit document must be uploaded before moving to Permit',
  },
  install_scheduled: {
    check: (deal) => !!deal.install_date,
    message: 'Install date must be set before scheduling',
  },
  installed: {
    check: (deal) => deal.install_images && deal.install_images.length > 0,
    message: 'Installation photos must be uploaded before marking as Installed',
  },
  complete: {
    check: (deal) => deal.completion_images && deal.completion_images.length > 0,
    message: 'Completion photos must be uploaded before marking as Complete',
  },
  pending: {
    check: () => false, // Can't drag to pending - must use request payment button
    message: 'Use the Request Payment button in the deal details to mark as Pending',
  },
  paid: {
    check: (deal) => deal.status === 'pending', // Can only move to paid from pending
    message: 'Deal must be in Pending status (payment requested by rep). Admin approval moves it to Paid.',
  },
};

export function DealsKanban({ deals, onViewDeal }: DealsKanbanProps) {
  const queryClient = useQueryClient();

  const validateStatusChange = (deal: Deal, newStatus: DealStatus): boolean => {
    // Allow moving backwards or to cancelled
    if (newStatus === 'cancelled' || newStatus === 'lead') return true;
    
    const requirement = statusRequirements[newStatus];
    if (requirement && !requirement.check(deal)) {
      toast.error(requirement.message);
      return false;
    }
    return true;
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ dealId, newStatus }: { dealId: string; newStatus: DealStatus }) => {
      const { error } = await supabase
        .from('deals')
        .update({ status: newStatus })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Deal status updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('dealId', dealId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: DealStatus) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    const deal = deals.find(d => d.id === dealId);
    
    if (dealId && deal) {
      if (!validateStatusChange(deal, newStatus)) return;
      updateStatusMutation.mutate({ dealId, newStatus });
    }
  };

  const getDealsForColumn = (status: DealStatus) => {
    return deals.filter((deal) => deal.status === status);
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {columns.map((column) => {
          const columnDeals = getDealsForColumn(column.id);
          const totalValue = columnDeals.reduce((sum, deal) => sum + deal.total_price, 0);

          return (
            <div
              key={column.id}
              className="w-[280px] flex-shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <span className="font-medium text-sm">{column.title}</span>
                  <Badge variant="secondary" className="text-xs">
                    {columnDeals.length}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  ${totalValue.toLocaleString()}
                </span>
              </div>

              {/* Column Content */}
              <div className="bg-muted/50 rounded-lg p-2 min-h-[400px] space-y-2">
                {columnDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal.id)}
                    onClick={() => onViewDeal(deal)}
                    className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {deal.homeowner_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {deal.address}
                        </p>
                      </div>
                      <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                      <span className="text-sm font-medium text-primary">
                        ${deal.total_price.toLocaleString()}
                      </span>
                      {deal.contract_signed && (
                        <FileSignature className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </div>
                ))}

                {columnDeals.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                    No deals
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
