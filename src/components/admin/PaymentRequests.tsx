import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, 
  Check, 
  X, 
  User, 
  Home, 
  FileText, 
  Camera, 
  FileSignature,
  ExternalLink 
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface PaymentRequest {
  id: string;
  homeowner_name: string;
  address: string;
  total_price: number;
  payment_requested_at: string;
  signature_url: string | null;
  permit_file_url: string | null;
  install_images: string[] | null;
  completion_images: string[] | null;
  repName: string | null;
}

export function PaymentRequests() {
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['payment-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(`
          id,
          homeowner_name,
          address,
          total_price,
          payment_requested_at,
          signature_url,
          permit_file_url,
          install_images,
          completion_images,
          deal_commissions!inner(rep_id, rep:reps(user_id))
        `)
        .eq('payment_requested', true)
        .neq('status', 'paid')
        .order('payment_requested_at', { ascending: false });

      if (error) throw error;

      // Fetch rep names
      const repUserIds = [...new Set(
        data?.flatMap(d => d.deal_commissions?.map((c: any) => c.rep?.user_id)).filter(Boolean)
      )] as string[];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', repUserIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      return data?.map(d => ({
        ...d,
        repName: d.deal_commissions?.[0]?.rep?.user_id 
          ? profileMap.get(d.deal_commissions[0].rep.user_id) 
          : null,
      })) || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const { error } = await supabase
        .from('deals')
        .update({ status: 'paid', payment_requested: false })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-stats'] });
      toast.success('Payment approved - deal marked as paid');
    },
    onError: (error) => {
      toast.error('Failed to approve: ' + error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const { error } = await supabase
        .from('deals')
        .update({ payment_requested: false, payment_requested_at: null })
        .eq('id', dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('Payment request rejected');
    },
    onError: (error) => {
      toast.error('Failed to reject: ' + error.message);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payment Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700">
          <DollarSign className="h-5 w-5" />
          Payment Requests
          <Badge variant="secondary">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {requests.map((request) => (
          <div 
            key={request.id} 
            className="p-4 border border-border rounded-lg bg-card space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{request.homeowner_name}</p>
                <p className="text-sm text-muted-foreground">{request.address}</p>
                <div className="flex items-center gap-2 mt-1">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Rep: {request.repName || 'Unknown'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-primary">
                  ${request.total_price?.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Requested {format(new Date(request.payment_requested_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="flex flex-wrap gap-2">
              {request.signature_url && (
                <a href={request.signature_url} target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                    <FileSignature className="w-3 h-3" />
                    Signature
                    <ExternalLink className="w-3 h-3" />
                  </Badge>
                </a>
              )}
              {request.permit_file_url && (
                <a href={request.permit_file_url} target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                    <FileText className="w-3 h-3" />
                    Permit
                    <ExternalLink className="w-3 h-3" />
                  </Badge>
                </a>
              )}
              {request.install_images && request.install_images.length > 0 && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                      <Camera className="w-3 h-3" />
                      Install ({request.install_images.length})
                    </Badge>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Installation Photos</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                      {request.install_images.map((url, idx) => (
                        <img 
                          key={idx} 
                          src={url} 
                          alt={`Install ${idx + 1}`} 
                          className="w-full rounded-lg"
                        />
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {request.completion_images && request.completion_images.length > 0 && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                      <Home className="w-3 h-3" />
                      Complete ({request.completion_images.length})
                    </Badge>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Completion Photos</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                      {request.completion_images.map((url, idx) => (
                        <img 
                          key={idx} 
                          src={url} 
                          alt={`Completion ${idx + 1}`} 
                          className="w-full rounded-lg"
                        />
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="flex-1 gap-1"
                onClick={() => approveMutation.mutate(request.id)}
                disabled={approveMutation.isPending}
              >
                <Check className="w-4 h-4" />
                Approve & Pay
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => rejectMutation.mutate(request.id)}
                disabled={rejectMutation.isPending}
              >
                <X className="w-4 h-4" />
                Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
