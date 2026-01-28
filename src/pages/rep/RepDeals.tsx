import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dealsApi, Deal } from '@/integrations/aws/api';
import { RepLayout } from '@/components/RepLayout';
import { DealsTable } from '@/components/crm/DealsTable';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, LayoutList, Columns3, ChevronRight } from 'lucide-react';
import { dealStatusConfig, phaseConfig, DealStatus, getProgressPercentage } from '@/lib/crmProcess';
import { cn } from '@/lib/utils';

type ViewMode = 'pipeline' | 'table' | 'kanban';

export default function RepDeals() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');

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
    navigate(`/deals/${deal.id}`);
  };

  // Group deals by phase
  const dealsByPhase = {
    sign: deals?.filter(d => ['lead', 'inspection_scheduled', 'claim_filed', 'adjuster_scheduled', 'adjuster_met', 'approved', 'signed'].includes(d.status)) || [],
    build: deals?.filter(d => ['materials_ordered', 'materials_delivered', 'install_scheduled', 'installed'].includes(d.status)) || [],
    collect: deals?.filter(d => ['invoice_sent', 'depreciation_collected', 'complete'].includes(d.status)) || [],
  };

  // Calculate phase values
  const phaseValues = {
    sign: dealsByPhase.sign.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
    build: dealsByPhase.build.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
    collect: dealsByPhase.collect.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
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
                <TabsTrigger value="pipeline" className="gap-1.5">
                  <Columns3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Pipeline</span>
                </TabsTrigger>
                <TabsTrigger value="table" className="gap-1.5">
                  <LayoutList className="w-4 h-4" />
                  <span className="hidden sm:inline">Table</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button onClick={() => navigate('/deals/new')} className="gap-2">
              <Plus className="w-4 h-4" />
              New Deal
            </Button>
          </div>
        </div>

        {/* Phase Summary Cards */}
        {viewMode === 'pipeline' && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {(['sign', 'build', 'collect'] as const).map((phase) => (
              <Card key={phase} className={cn(
                "border-l-4",
                phase === 'sign' && "border-l-blue-500",
                phase === 'build' && "border-l-orange-500",
                phase === 'collect' && "border-l-green-500"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{phaseConfig[phase].icon}</span>
                    <span className="font-semibold text-sm">{phaseConfig[phase].label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold">{dealsByPhase[phase].length}</span>
                    <span className="text-xs text-muted-foreground">deals</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${phaseValues[phase].toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : viewMode === 'pipeline' ? (
            <div className="space-y-3">
              {deals?.map((deal) => {
                const config = dealStatusConfig[deal.status as DealStatus] || dealStatusConfig.lead;
                const progress = getProgressPercentage(deal.status as DealStatus);

                return (
                  <Card
                    key={deal.id}
                    className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
                    onClick={() => handleViewDeal(deal)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{deal.homeowner_name}</h3>
                            <Badge
                              variant="outline"
                              style={{ borderColor: config.color, color: config.color }}
                              className="text-xs"
                            >
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{deal.address}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-sm font-medium">
                              ${(deal.rcv || deal.total_price || 0).toLocaleString()}
                            </span>
                            <div className="flex-1 max-w-[120px]">
                              <Progress value={progress} className="h-1.5" />
                            </div>
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {(!deals || deals.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No deals yet</p>
                  <Button onClick={() => navigate('/deals/new')} className="mt-4">
                    Create Your First Deal
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <DealsTable deals={deals || []} onViewDeal={handleViewDeal} />
          )}
        </div>
      </div>
    </RepLayout>
  );
}
