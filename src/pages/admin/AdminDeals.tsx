import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dealsApi, repsApi, Deal } from '@/integrations/aws/api';
import { AdminShell } from '@/components/AdminShell';
import { DealWizard } from '@/components/crm/DealWizard';
import { DealDetailSheet } from '@/components/crm/DealDetailSheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search, Users, DollarSign, FileSignature, ChevronRight, Package, Truck, CheckCircle2, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  lead: { label: 'Lead', color: 'text-slate-600', bgColor: 'bg-slate-100' },
  inspection_scheduled: { label: 'Inspected', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  claim_filed: { label: 'Claim Filed', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  adjuster_scheduled: { label: 'Adj. Scheduled', color: 'text-pink-600', bgColor: 'bg-pink-100' },
  adjuster_met: { label: 'Adjuster Met', color: 'text-pink-600', bgColor: 'bg-pink-100' },
  approved: { label: 'Approved', color: 'text-teal-600', bgColor: 'bg-teal-100' },
  signed: { label: 'Ready', color: 'text-green-600', bgColor: 'bg-green-100' },
  collect_acv: { label: 'Collect ACV', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  collect_deductible: { label: 'Collect Ded.', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  install_scheduled: { label: 'Scheduled', color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  installed: { label: 'Installed', color: 'text-teal-600', bgColor: 'bg-teal-100' },
  invoice_sent: { label: 'RCV Sent', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  depreciation_collected: { label: 'Dep. Collected', color: 'text-teal-600', bgColor: 'bg-teal-100' },
  complete: { label: 'Complete', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-100' },
  on_hold: { label: 'On Hold', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

export default function AdminDeals() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [repFilter, setRepFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Fetch all deals
  const { data: deals, isLoading } = useQuery({
    queryKey: ['deals', 'admin'],
    queryFn: async () => {
      const response = await dealsApi.list();
      if (response.error) throw new Error(response.error);
      return (response.data || []) as Deal[];
    },
  });

  // Fetch all reps
  const { data: allReps } = useQuery({
    queryKey: ['all-reps'],
    queryFn: async () => {
      const response = await repsApi.list();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
  });

  // Filter deals
  const filteredDeals = deals?.filter((deal) => {
    if (repFilter !== 'all' && !deal.deal_commissions?.some((c) => c.rep_id === repFilter)) return false;
    if (statusFilter !== 'all' && deal.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!deal.homeowner_name.toLowerCase().includes(q) && !deal.address.toLowerCase().includes(q)) return false;
    }
    return true;
  }) || [];

  // Stats
  const stats = {
    total: filteredDeals.length,
    readyForAction: filteredDeals.filter(d => ['signed', 'collect_acv', 'collect_deductible', 'install_scheduled', 'installed'].includes(d.status)).length,
    totalValue: filteredDeals.reduce((sum, d) => sum + (d.rcv || d.total_price || 0), 0),
  };

  // Group deals by status for quick view
  const needsAction = filteredDeals.filter(d =>
    ['signed', 'collect_acv', 'collect_deductible', 'install_scheduled', 'installed'].includes(d.status)
  );

  return (
    <AdminShell>
      <div className="flex flex-col h-full p-4 space-y-4 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">CRM - All Deals</h1>
            <p className="text-sm text-muted-foreground">Manage deals across your team</p>
          </div>
          <Button onClick={() => setWizardOpen(true)} size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>

        {/* Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="bg-card">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Action Needed</p>
              <p className="text-xl font-bold text-primary">{stats.readyForAction}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Value</p>
              <p className="text-lg font-bold text-green-600">${(stats.totalValue / 1000).toFixed(0)}k</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="flex-1">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Rep" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                {allReps?.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.full_name || rep.email || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="inspection_scheduled">Inspection Scheduled</SelectItem>
                <SelectItem value="claim_filed">Claim Filed</SelectItem>
                <SelectItem value="adjuster_met">Adjuster Met</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="signed">Ready for Install</SelectItem>
                <SelectItem value="collect_acv">Collect ACV</SelectItem>
                <SelectItem value="collect_deductible">Collect Deductible</SelectItem>
                <SelectItem value="install_scheduled">Scheduled</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="invoice_sent">RCV Sent</SelectItem>
                <SelectItem value="depreciation_collected">Depreciation Collected</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Needs Action Section */}
        {needsAction.length > 0 && statusFilter === 'all' && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
              <Clock className="w-4 h-4" />
              Needs Your Action ({needsAction.length})
            </h3>
            <div className="space-y-2">
              {needsAction.slice(0, 3).map((deal) => (
                <Card
                  key={deal.id}
                  className="border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => setSelectedDeal(deal)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{deal.homeowner_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{deal.address}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-xs", statusConfig[deal.status]?.bgColor, statusConfig[deal.status]?.color)}>
                          {statusConfig[deal.status]?.label || deal.status}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      {deal.status === 'signed' && (
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <Package className="w-3 h-3" /> Collect ACV
                        </span>
                      )}
                      {deal.status === 'collect_acv' && (
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <Truck className="w-3 h-3" /> Collect Deductible
                        </span>
                      )}
                      {deal.status === 'collect_deductible' && (
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <Clock className="w-3 h-3" /> Schedule Install
                        </span>
                      )}
                      {deal.status === 'install_scheduled' && (
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Mark Installed
                        </span>
                      )}
                      {deal.status === 'installed' && (
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <DollarSign className="w-3 h-3" /> Send Invoice
                        </span>
                      )}
                      {deal.rcv && <span>${deal.rcv.toLocaleString()}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Deals List */}
        <div className="space-y-2 flex-1">
          <h3 className="text-sm font-semibold text-muted-foreground">
            All Deals ({filteredDeals.length})
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No deals found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDeals.map((deal) => (
                <Card
                  key={deal.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 transition-colors",
                    deal.approval_type === 'supplement_needed' && "border-amber-500/50"
                  )}
                  onClick={() => setSelectedDeal(deal)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{deal.homeowner_name}</p>
                          {deal.contract_signed && (
                            <FileSignature className="w-3 h-3 text-primary flex-shrink-0" />
                          )}
                          {deal.approval_type === 'supplement_needed' && (
                            <span className="text-xs text-amber-600">⚠️</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{deal.address}</p>
                        {/* Show rep name if available */}
                        {deal.deal_commissions?.[0]?.rep_name && (
                          <p className="text-xs text-muted-foreground">
                            Rep: {deal.deal_commissions[0].rep_name}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={cn("text-xs", statusConfig[deal.status]?.color)}>
                          {statusConfig[deal.status]?.label || deal.status}
                        </Badge>
                        {(deal.rcv || deal.total_price) && (
                          <span className="text-xs font-medium text-green-600">
                            ${(deal.rcv || deal.total_price || 0).toLocaleString()}
                          </span>
                        )}
                        {deal.install_date && (
                          <span className="text-[10px] text-muted-foreground">
                            Install: {new Date(deal.install_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <DealWizard open={wizardOpen} onOpenChange={setWizardOpen} isAdmin />
      <DealDetailSheet
        deal={selectedDeal}
        isOpen={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        isAdmin
      />
    </AdminShell>
  );
}
