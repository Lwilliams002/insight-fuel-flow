import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dealsApi, Deal } from '@/integrations/aws/api';
import { RepLayout } from '@/components/RepLayout';
import { DealsTable } from '@/components/crm/DealsTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, LayoutList, Columns3, ChevronRight, Search, X } from 'lucide-react';
import { dealStatusConfig, phaseConfig, DealStatus, getProgressPercentage } from '@/lib/crmProcess';
import { cn } from '@/lib/utils';

type ViewMode = 'pipeline' | 'leads';

export default function RepDeals() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [searchQuery, setSearchQuery] = useState('');

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
    sign: deals?.filter(d => ['inspection_scheduled', 'claim_filed', 'adjuster_met', 'approved', 'signed'].includes(d.status)) || [],
    build: deals?.filter(d => ['collect_acv', 'collect_deductible', 'install_scheduled', 'installed'].includes(d.status)) || [],
    finalizing: deals?.filter(d => ['invoice_sent', 'depreciation_collected'].includes(d.status)) || [],
    complete: deals?.filter(d => d.status === 'complete') || [],
  };

  // Filter leads separately
  const leads = deals?.filter(d => d.status === 'lead') || [];

  // Filter deals by search query
  const filteredDeals = deals?.filter(deal => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      deal.homeowner_name?.toLowerCase().includes(query) ||
      deal.address?.toLowerCase().includes(query) ||
      deal.city?.toLowerCase().includes(query) ||
      deal.homeowner_phone?.includes(query) ||
      deal.insurance_company?.toLowerCase().includes(query)
    );
  }) || [];

  // Calculate phase values
  const phaseValues = {
    sign: dealsByPhase.sign.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
    build: dealsByPhase.build.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
    finalizing: dealsByPhase.finalizing.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
    complete: dealsByPhase.complete.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
  };

  return (
    <RepLayout title="My Pipeline">
      <div className="flex flex-col h-full p-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">My Pipeline</h1>
            <p className="text-muted-foreground text-sm">
              {viewMode === 'leads' 
                ? `${leads.length} leads`
                : `${deals?.filter(deal => deal.status !== 'lead').length || 0} deals in pipeline`
              }
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
                <TabsTrigger value="leads" className="gap-1.5">
                  <LayoutList className="w-4 h-4" />
                  <span className="hidden sm:inline">Leads</span>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {(['sign', 'build', 'finalizing', 'complete'] as const).map((phase) => (
              <Card key={phase} className={cn(
                "border-l-4",
                phase === 'sign' && "border-l-blue-500",
                phase === 'build' && "border-l-orange-500",
                phase === 'finalizing' && "border-l-yellow-500",
                phase === 'complete' && "border-l-green-500"
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

        {/* Search Bar - Show in pipeline mode */}
        {viewMode === 'pipeline' && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, address, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
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
              {filteredDeals?.filter(deal => deal.status !== 'lead').map((deal) => {
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
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredDeals?.filter(deal => deal.status !== 'lead').length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery ? (
                    <>
                      <p>No deals found matching "{searchQuery}"</p>
                      <Button variant="outline" onClick={() => setSearchQuery('')} className="mt-4">
                        Clear Search
                      </Button>
                    </>
                  ) : (
                    <>
                      <p>No deals in pipeline yet</p>
                      <Button onClick={() => navigate('/deals/new')} className="mt-4">
                        Create Your First Deal
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <DealsTable deals={leads} onViewDeal={handleViewDeal} />
          )}
        </div>
      </div>
    </RepLayout>
  );
}