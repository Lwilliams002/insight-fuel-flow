import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Check, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentRequests } from '@/components/admin/PaymentRequests';

export default function AdminCommissions() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: commissions, isLoading } = useQuery({
    queryKey: ['admin-commissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_commissions')
        .select(`*, deal:deals(id, homeowner_name, address), rep:reps(id, user_id)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const repUserIds = [...new Set(data?.map(c => c.rep?.user_id).filter(Boolean))] as string[];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', repUserIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      
      return data?.map(c => ({ ...c, repName: c.rep?.user_id ? profileMap.get(c.rep.user_id) : null })) || [];
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('deal_commissions')
        .update({ paid: true, paid_date: new Date().toISOString().split('T')[0] })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-commissions'] });
      setSelectedIds([]);
      toast.success('Commissions marked as paid');
    },
  });

  const unpaidCommissions = commissions?.filter(c => !c.paid) || [];
  const paidCommissions = commissions?.filter(c => c.paid) || [];
  const totalSelected = selectedIds.reduce((sum, id) => sum + Number(commissions?.find(c => c.id === id)?.commission_amount || 0), 0);

  return (
    <AdminLayout title="Commissions">
      <div className="p-4 space-y-6">
        {/* Payment Requests Section - Where reps request payment from admins */}
        <PaymentRequests />

        {/* Commission Management Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Rep Commissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {unpaidCommissions.length > 0 && (
              <div className="flex items-center justify-between gap-2 p-3 bg-muted rounded-lg">
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(unpaidCommissions.map(c => c.id))}>Select All</Button>
                <span className="text-sm">{selectedIds.length} (${totalSelected.toLocaleString()})</span>
                <Button size="sm" disabled={!selectedIds.length} onClick={() => markPaidMutation.mutate(selectedIds)}>
                  <Check className="h-4 w-4 mr-1" /> Mark Paid
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">Pending ({unpaidCommissions.length})</h2>
              {isLoading ? <Skeleton className="h-24" /> : unpaidCommissions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No pending commissions</p>
              ) : unpaidCommissions.map((comm) => (
                <div key={comm.id} className={`p-4 flex gap-3 border rounded-lg ${selectedIds.includes(comm.id) ? 'border-primary' : 'border-border'}`}>
                  <Checkbox checked={selectedIds.includes(comm.id)} onCheckedChange={() => setSelectedIds(prev => prev.includes(comm.id) ? prev.filter(i => i !== comm.id) : [...prev, comm.id])} />
                  <div className="flex-1">
                    <p className="font-medium">{comm.repName || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{comm.deal?.homeowner_name}</p>
                  </div>
                  <p className="font-bold text-primary">${Number(comm.commission_amount).toLocaleString()}</p>
                </div>
              ))}
            </div>

            {paidCommissions.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Paid ({paidCommissions.length})</h2>
                {paidCommissions.slice(0, 10).map((comm) => (
                  <div key={comm.id} className="p-4 flex justify-between border rounded-lg opacity-75">
                    <div>
                      <p className="font-medium">{comm.repName || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{comm.deal?.homeowner_name}</p>
                    </div>
                    <Badge variant="outline">Paid</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
