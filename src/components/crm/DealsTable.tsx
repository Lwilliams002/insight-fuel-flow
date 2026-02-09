import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi, Deal, DealStatus } from '@/integrations/aws/api';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ChevronUp, ChevronDown, Eye, FileSignature } from 'lucide-react';
import { toast } from 'sonner';


interface DealsTableProps {
  deals: Deal[];
  onViewDeal: (deal: Deal) => void;
  isAdmin?: boolean;
}

const statusConfig: Record<DealStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  // SIGN PHASE
  lead: { label: 'Lead', variant: 'secondary' },
  inspection_scheduled: { label: 'Inspection Scheduled', variant: 'outline' },
  claim_filed: { label: 'Claim Filed', variant: 'outline' },
  adjuster_met: { label: 'Awaiting Approval', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  signed: { label: 'Signed', variant: 'default' },
  // BUILD PHASE
  collect_acv: { label: 'Collect ACV', variant: 'outline' },
  collect_deductible: { label: 'Collect Deductible', variant: 'outline' },
  install_scheduled: { label: 'Scheduled', variant: 'outline' },
  installed: { label: 'Installed', variant: 'default' },
  // COLLECT PHASE
invoice_sent: { label: 'RCV Sent', variant: 'outline' },
  depreciation_collected: { label: 'Depreciation Collected', variant: 'default' },
  complete: { label: 'Complete', variant: 'default' },
  // OTHER
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  on_hold: { label: 'On Hold', variant: 'secondary' },
  // LEGACY
  permit: { label: 'Permit', variant: 'outline' },
  pending: { label: 'Payment Pending', variant: 'outline' },
  paid: { label: 'Paid', variant: 'default' },
  materials_ordered: { label: 'Materials Ordered', variant: 'outline' },
  materials_delivered: { label: 'Materials Delivered', variant: 'outline' },
  adjuster_scheduled: { label: 'Adjuster Scheduled', variant: 'outline' },
};

type SortField = 'homeowner_name' | 'address' | 'status' | 'total_price' | 'created_at';
type SortDirection = 'asc' | 'desc';

// Build phase statuses that only admins can set
const adminOnlyStatuses: DealStatus[] = ['collect_acv', 'collect_deductible', 'install_scheduled', 'installed', 'invoice_sent', 'depreciation_collected', 'complete', 'paid'];

// Status requirements - what's needed to move to each status
const statusRequirements: Partial<Record<DealStatus, { check: (deal: Deal, isAdmin?: boolean) => boolean; message: string }>> = {
  signed: {
    check: (deal) => deal.contract_signed === true,
    message: 'Contract must be signed before marking as Signed',
  },
  permit: {
    check: (deal) => !!deal.permit_file_url,
    message: 'Permit document must be uploaded before moving to Permit',
  },
  collect_acv: {
    check: (deal, isAdmin) => isAdmin === true,
    message: 'Only admins can collect ACV and advance to build phase',
  },
  collect_deductible: {
    check: (deal, isAdmin) => isAdmin === true,
    message: 'Only admins can collect deductible',
  },
  install_scheduled: {
    check: (deal, isAdmin) => isAdmin === true && !!deal.install_date,
    message: 'Only admins can schedule installations. Install date must be set.',
  },
  installed: {
    check: (deal, isAdmin) => isAdmin === true && deal.install_images && deal.install_images.length > 0,
    message: 'Only admins can mark as installed. Installation photos must be uploaded.',
  },
  complete: {
    check: (deal, isAdmin) => isAdmin === true && deal.completion_images && deal.completion_images.length > 0,
    message: 'Only admins can mark as complete. Completion photos must be uploaded.',
  },
  pending: {
    check: () => false, // Can't drag to pending - must use request payment button
    message: 'Use the Request Payment button in the deal details to mark as Pending',
  },
  paid: {
    check: (deal, isAdmin) => isAdmin === true && (deal.status === 'pending' || deal.status === 'complete'),
    message: 'Only admins can mark as paid. Deal must be in Complete or Pending status.',
  },
};

export function DealsTable({ deals, onViewDeal, isAdmin = false }: DealsTableProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DealStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const validateStatusChange = (deal: Deal, newStatus: DealStatus): boolean => {
    // Allow moving backwards or to cancelled
    if (newStatus === 'cancelled' || newStatus === 'lead') return true;
    
    // Check if this is an admin-only status
    if (adminOnlyStatuses.includes(newStatus) && !isAdmin) {
      toast.error('Only admins can change to this status');
      return false;
    }

    const requirement = statusRequirements[newStatus];
    if (requirement && !requirement.check(deal, isAdmin)) {
      toast.error(requirement.message);
      return false;
    }
    return true;
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ dealId, status }: { dealId: string; status: DealStatus }) => {
      const response = await dealsApi.update(dealId, { status });
      if (response.error) throw new Error(response.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const handleStatusChange = (deal: Deal, newStatus: DealStatus) => {
    if (deal.status === newStatus) return;
    if (!validateStatusChange(deal, newStatus)) return;
    updateStatusMutation.mutate({ dealId: deal.id, status: newStatus });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  const filteredDeals = deals
    .filter((deal) => {
      const matchesSearch =
        deal.homeowner_name.toLowerCase().includes(search.toLowerCase()) ||
        deal.address.toLowerCase().includes(search.toLowerCase()) ||
        (deal.homeowner_email?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === 'all' || deal.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const aVal = a[sortField] as string | number;
      const bVal = b[sortField] as string | number;

      let aCompare: string | number = aVal;
      let bCompare: string | number = bVal;

      if (sortField === 'total_price') {
        aCompare = Number(aVal);
        bCompare = Number(bVal);
      }

      if (aCompare < bCompare) return sortDirection === 'asc' ? -1 : 1;
      if (aCompare > bCompare) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DealStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('homeowner_name')}
              >
                Homeowner <SortIcon field="homeowner_name" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('address')}
              >
                Address <SortIcon field="address" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('status')}
              >
                Status <SortIcon field="status" />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('total_price')}
              >
                Price <SortIcon field="total_price" />
              </TableHead>
              <TableHead className="text-center">Contract</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('created_at')}
              >
                Created <SortIcon field="created_at" />
              </TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No deals found
                </TableCell>
              </TableRow>
            ) : (
              filteredDeals.map((deal) => (
                <TableRow key={deal.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{deal.homeowner_name}</TableCell>
                  <TableCell>
                    <div className="truncate max-w-[200px]">
                      {deal.address}
                      {deal.city && `, ${deal.city}`}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isAdmin ? (
                      <Select
                        value={deal.status}
                        onValueChange={(value) => handleStatusChange(deal, value as DealStatus)}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <Badge variant={statusConfig[deal.status]?.variant || 'secondary'}>
                            {statusConfig[deal.status]?.label || deal.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(statusConfig) as DealStatus[]).map((status) => (
                            <SelectItem key={status} value={status}>
                              {statusConfig[status].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={statusConfig[deal.status]?.variant || 'secondary'}>
                        {statusConfig[deal.status]?.label || deal.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${deal.total_price.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    {deal.contract_signed ? (
                      <FileSignature className="w-4 h-4 text-primary mx-auto" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(deal.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDeal(deal)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredDeals.length} of {deals.length} deals
      </div>
    </div>
  );
}
