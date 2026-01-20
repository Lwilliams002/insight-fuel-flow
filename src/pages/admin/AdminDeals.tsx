import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Home, MapPin, Plus, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  lead: 'bg-yellow-500/20 text-yellow-700',
  signed: 'bg-blue-500/20 text-blue-700',
  permit: 'bg-purple-500/20 text-purple-700',
  install_scheduled: 'bg-orange-500/20 text-orange-700',
  installed: 'bg-green-500/20 text-green-700',
  complete: 'bg-emerald-500/20 text-emerald-700',
  paid: 'bg-primary/20 text-primary',
  cancelled: 'bg-destructive/20 text-destructive',
};

const statusLabels: Record<string, string> = {
  lead: 'Lead',
  signed: 'Signed',
  permit: 'Permit',
  install_scheduled: 'Scheduled',
  installed: 'Installed',
  complete: 'Complete',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const statusOptions = ['lead', 'signed', 'permit', 'install_scheduled', 'installed', 'complete', 'paid', 'cancelled'];

export default function AdminDeals() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: deals, isLoading } = useQuery({
    queryKey: ['admin-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          *,
          deal_commissions(
            id,
            rep_id,
            commission_type,
            commission_amount,
            paid,
            rep:reps(id, user_id)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profiles separately for rep names
      const repUserIds = [...new Set(
        data?.flatMap(d => d.deal_commissions?.map((c: any) => c.rep?.user_id)).filter(Boolean)
      )] as string[];
      
      if (repUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', repUserIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        
        return data?.map(d => ({
          ...d,
          deal_commissions: d.deal_commissions?.map((c: any) => ({
            ...c,
            repName: c.rep?.user_id ? profileMap.get(c.rep.user_id) : null
          }))
        })) || [];
      }
      
      return data || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ dealId, status }: { dealId: string; status: string }) => {
      const { error } = await supabase
        .from('deals')
        .update({ status: status as any })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      toast.success('Deal status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const filteredDeals = deals?.filter(d => filterStatus === 'all' || d.status === filterStatus) || [];

  return (
    <AdminLayout title="All Deals">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statusOptions.map(s => (
                <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link to="/admin/jotform">
            <Button size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <p className="text-sm text-muted-foreground">
          {filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}
        </p>

        {isLoading ? (
          <>
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </>
        ) : filteredDeals.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Home className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p>No deals found</p>
            </CardContent>
          </Card>
        ) : (
          filteredDeals.map((deal) => (
            <Card key={deal.id} className="shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold text-foreground">{deal.homeowner_name}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{deal.address}{deal.city ? `, ${deal.city}` : ''}</span>
                    </div>
                  </div>
                  <Select
                    value={deal.status}
                    onValueChange={(value) => updateStatusMutation.mutate({ dealId: deal.id, status: value })}
                  >
                    <SelectTrigger className="w-32">
                      <Badge className={statusColors[deal.status] || 'bg-muted'}>
                        {statusLabels[deal.status]}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => (
                        <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Job Total</p>
                    <p className="font-medium">${Number(deal.total_price).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assigned Reps</p>
                    <p className="font-medium">{deal.deal_commissions?.length || 0}</p>
                  </div>
                </div>

                {deal.deal_commissions && deal.deal_commissions.length > 0 && (
                  <div className="text-xs space-y-1 border-t pt-2">
                    {deal.deal_commissions.map((comm: any) => (
                      <div key={comm.id} className="flex justify-between items-center">
                        <span className="capitalize">
                          {comm.commission_type.replace('_', ' ')}: {comm.repName || 'Unknown'}
                        </span>
                        <span className="text-primary font-medium">
                          ${Number(comm.commission_amount).toLocaleString()}
                          {comm.paid && <Badge variant="outline" className="ml-1 text-primary text-[10px]">Paid</Badge>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AdminLayout>
  );
}
