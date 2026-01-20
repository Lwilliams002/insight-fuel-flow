import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RepLayout } from '@/components/RepLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Home, MapPin, DollarSign, Calendar } from 'lucide-react';
import { format } from 'date-fns';

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

export default function RepDeals() {
  const { data: deals, isLoading } = useQuery({
    queryKey: ['rep-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_commissions')
        .select(`
          id,
          commission_type,
          commission_percent,
          commission_amount,
          paid,
          deal:deals(
            id,
            address,
            city,
            state,
            homeowner_name,
            total_price,
            status,
            signed_date,
            install_date
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  return (
    <RepLayout title="My Deals">
      <div className="space-y-4 p-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          {deals?.length || 0} deals assigned to you
        </h2>

        {isLoading ? (
          <>
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </>
        ) : deals?.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Home className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p>No deals assigned yet</p>
            </CardContent>
          </Card>
        ) : (
          deals?.map((commission) => {
            const deal = commission.deal;
            if (!deal) return null;
            
            return (
              <Card key={commission.id} className="shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">{deal.homeowner_name}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{deal.address}{deal.city ? `, ${deal.city}` : ''}</span>
                      </div>
                    </div>
                    <Badge className={statusColors[deal.status] || 'bg-muted'}>
                      {statusLabels[deal.status] || deal.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Job Total</p>
                      <p className="font-medium">${Number(deal.total_price).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Your Role</p>
                      <p className="font-medium capitalize">{commission.commission_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Commission</p>
                      <p className="font-medium text-primary">
                        ${Number(commission.commission_amount).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {deal.install_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Install: {format(new Date(deal.install_date), 'MMM d, yyyy')}</span>
                    </div>
                  )}

                  {commission.paid && (
                    <Badge variant="outline" className="text-primary border-primary">
                      Commission Paid
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </RepLayout>
  );
}
