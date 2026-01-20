import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, UserPlus } from 'lucide-react';

interface Merchant {
  id: string;
  name: string;
  mid: string | null;
  status: string;
}

interface Rep {
  id: string;
  user_id: string;
  default_commission_percent: number;
  profile: {
    full_name: string | null;
    email: string;
  } | null;
}

interface Assignment {
  id: string;
  merchant_id: string;
  rep_id: string;
  percent_override: number | null;
  rep: {
    id: string;
    profile: {
      full_name: string | null;
    } | null;
  };
}

export default function MerchantsManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [assigningMerchant, setAssigningMerchant] = useState<Merchant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    mid: '',
    status: 'active',
  });
  const [assignmentData, setAssignmentData] = useState({
    repId: '',
    percentOverride: '',
  });
  const queryClient = useQueryClient();

  const { data: merchants, isLoading } = useQuery({
    queryKey: ['merchants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Merchant[];
    },
  });

  const { data: reps } = useQuery({
    queryKey: ['reps-for-assignment'],
    queryFn: async () => {
      const { data: repsData, error: repsError } = await supabase
        .from('reps')
        .select('id, user_id, default_commission_percent');

      if (repsError) throw repsError;

      const userIds = repsData.map(r => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      return repsData.map(rep => ({
        ...rep,
        profile: profilesData.find(p => p.id === rep.user_id) || null,
      })) as Rep[];
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ['merchant-assignments'],
    queryFn: async () => {
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('merchant_assignments')
        .select('id, merchant_id, rep_id, percent_override');

      if (assignmentsError) throw assignmentsError;

      const repIds = [...new Set(assignmentsData.map(a => a.rep_id))];
      const { data: repsData, error: repsError } = await supabase
        .from('reps')
        .select('id, user_id')
        .in('id', repIds);

      if (repsError) throw repsError;

      const userIds = repsData.map(r => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      return assignmentsData.map(assignment => {
        const rep = repsData.find(r => r.id === assignment.rep_id);
        const profile = rep ? profilesData.find(p => p.id === rep.user_id) : null;
        return {
          ...assignment,
          rep: rep ? { id: rep.id, profile } : null,
        };
      }) as Assignment[];
    },
  });

  const createMerchantMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('merchants').insert({
        name: data.name,
        mid: data.mid || null,
        status: data.status,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchants'] });
      setIsCreateOpen(false);
      resetForm();
      toast.success('Merchant created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create merchant: ' + error.message);
    },
  });

  const updateMerchantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('merchants')
        .update({
          name: data.name,
          mid: data.mid || null,
          status: data.status,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchants'] });
      setEditingMerchant(null);
      toast.success('Merchant updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update merchant: ' + error.message);
    },
  });

  const deleteMerchantMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('merchants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchants'] });
      toast.success('Merchant deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete merchant: ' + error.message);
    },
  });

  const assignRepMutation = useMutation({
    mutationFn: async ({ merchantId, repId, percentOverride }: { merchantId: string; repId: string; percentOverride: number | null }) => {
      // Remove existing assignment for this merchant-rep combo
      await supabase
        .from('merchant_assignments')
        .delete()
        .eq('merchant_id', merchantId)
        .eq('rep_id', repId);

      // Create new assignment
      const { error } = await supabase.from('merchant_assignments').insert({
        merchant_id: merchantId,
        rep_id: repId,
        percent_override: percentOverride,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-assignments'] });
      setAssigningMerchant(null);
      setAssignmentData({ repId: '', percentOverride: '' });
      toast.success('Rep assigned successfully');
    },
    onError: (error) => {
      toast.error('Failed to assign rep: ' + error.message);
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from('merchant_assignments').delete().eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-assignments'] });
      toast.success('Assignment removed');
    },
    onError: (error) => {
      toast.error('Failed to remove assignment: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ name: '', mid: '', status: 'active' });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMerchantMutation.mutate(formData);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMerchant) return;
    updateMerchantMutation.mutate({ id: editingMerchant.id, data: formData });
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningMerchant || !assignmentData.repId) return;
    assignRepMutation.mutate({
      merchantId: assigningMerchant.id,
      repId: assignmentData.repId,
      percentOverride: assignmentData.percentOverride ? parseFloat(assignmentData.percentOverride) : null,
    });
  };

  const getMerchantAssignments = (merchantId: string) => {
    return assignments?.filter((a) => a.merchant_id === merchantId) || [];
  };

  return (
    <AdminLayout title="Manage Merchants">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            {merchants?.length || 0} merchants
          </p>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Merchant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Merchant</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Merchant Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mid">MID / Account ID (optional)</Label>
                  <Input
                    id="mid"
                    value={formData.mid}
                    onChange={(e) => setFormData({ ...formData, mid: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createMerchantMutation.isPending}>
                  {createMerchantMutation.isPending ? 'Creating...' : 'Create Merchant'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : merchants?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No merchants yet. Create your first merchant to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {merchants?.map((merchant) => {
              const merchantAssignments = getMerchantAssignments(merchant.id);
              return (
                <Card key={merchant.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{merchant.name}</p>
                          <Badge variant={merchant.status === 'active' ? 'default' : 'secondary'}>
                            {merchant.status}
                          </Badge>
                        </div>
                        {merchant.mid && (
                          <p className="text-sm text-muted-foreground">MID: {merchant.mid}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {/* Assign Rep Dialog */}
                        <Dialog open={assigningMerchant?.id === merchant.id} onOpenChange={(open) => {
                          if (!open) {
                            setAssigningMerchant(null);
                            setAssignmentData({ repId: '', percentOverride: '' });
                          } else {
                            setAssigningMerchant(merchant);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon">
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Assign Rep to {merchant.name}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleAssign} className="space-y-4">
                              <div className="space-y-2">
                                <Label>Select Rep</Label>
                                <Select value={assignmentData.repId} onValueChange={(value) => setAssignmentData({ ...assignmentData, repId: value })}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose a rep..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {reps?.map((rep) => (
                                      <SelectItem key={rep.id} value={rep.id}>
                                        {rep.profile?.full_name || rep.profile?.email} ({rep.default_commission_percent}%)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="percentOverride">Commission Override % (optional)</Label>
                                <Input
                                  id="percentOverride"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  placeholder="Leave empty to use rep's default"
                                  value={assignmentData.percentOverride}
                                  onChange={(e) => setAssignmentData({ ...assignmentData, percentOverride: e.target.value })}
                                />
                              </div>
                              <Button type="submit" className="w-full" disabled={assignRepMutation.isPending || !assignmentData.repId}>
                                {assignRepMutation.isPending ? 'Assigning...' : 'Assign Rep'}
                              </Button>
                            </form>
                          </DialogContent>
                        </Dialog>

                        {/* Edit Dialog */}
                        <Dialog open={editingMerchant?.id === merchant.id} onOpenChange={(open) => {
                          if (!open) setEditingMerchant(null);
                          else {
                            setEditingMerchant(merchant);
                            setFormData({
                              name: merchant.name,
                              mid: merchant.mid || '',
                              status: merchant.status,
                            });
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Merchant</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleUpdate} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="editName">Merchant Name</Label>
                                <Input
                                  id="editName"
                                  value={formData.name}
                                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="editMid">MID / Account ID (optional)</Label>
                                <Input
                                  id="editMid"
                                  value={formData.mid}
                                  onChange={(e) => setFormData({ ...formData, mid: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button type="submit" className="w-full" disabled={updateMerchantMutation.isPending}>
                                {updateMerchantMutation.isPending ? 'Saving...' : 'Save Changes'}
                              </Button>
                            </form>
                          </DialogContent>
                        </Dialog>

                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this merchant?')) {
                              deleteMerchantMutation.mutate(merchant.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Show assigned reps */}
                    {merchantAssignments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">Assigned Reps:</p>
                        <div className="flex flex-wrap gap-2">
                          {merchantAssignments.map((assignment) => (
                            <Badge
                              key={assignment.id}
                              variant="outline"
                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => {
                                if (confirm('Remove this assignment?')) {
                                  removeAssignmentMutation.mutate(assignment.id);
                                }
                              }}
                            >
                              {assignment.rep?.profile?.full_name || 'Unknown'}
                              {assignment.percent_override && ` (${assignment.percent_override}%)`}
                              <span className="ml-1 opacity-50">×</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
