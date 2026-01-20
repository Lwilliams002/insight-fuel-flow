import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Rep {
  id: string;
  user_id: string;
  default_commission_percent: number;
  profile: {
    full_name: string | null;
    email: string;
  } | null;
}

export default function RepsManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<Rep | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    commissionPercent: '10',
  });
  const queryClient = useQueryClient();

  const { data: reps, isLoading } = useQuery({
    queryKey: ['reps'],
    queryFn: async () => {
      // First get all reps
      const { data: repsData, error: repsError } = await supabase
        .from('reps')
        .select('id, user_id, default_commission_percent')
        .order('created_at', { ascending: false });

      if (repsError) throw repsError;

      // Then get profiles for those reps
      const userIds = repsData.map(r => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Join them
      return repsData.map(rep => ({
        ...rep,
        profile: profilesData.find(p => p.id === rep.user_id) || null,
      })) as Rep[];
    },
  });

  const createRepMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Use edge function to create rep (runs with service role)
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-rep`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            fullName: data.fullName,
            commissionPercent: parseFloat(data.commissionPercent),
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create rep');
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      setIsCreateOpen(false);
      resetForm();
      toast.success('Rep created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create rep: ' + error.message);
    },
  });

  const updateRepMutation = useMutation({
    mutationFn: async ({ repId, commissionPercent }: { repId: string; commissionPercent: number }) => {
      const { error } = await supabase
        .from('reps')
        .update({ default_commission_percent: commissionPercent })
        .eq('id', repId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      setEditingRep(null);
      toast.success('Rep updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update rep: ' + error.message);
    },
  });

  const deleteRepMutation = useMutation({
    mutationFn: async (repId: string) => {
      const { error } = await supabase.from('reps').delete().eq('id', repId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      toast.success('Rep deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete rep: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      commissionPercent: '10',
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createRepMutation.mutate(formData);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRep) return;
    updateRepMutation.mutate({
      repId: editingRep.id,
      commissionPercent: parseFloat(formData.commissionPercent),
    });
  };

  return (
    <AdminLayout title="Manage Reps">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            {reps?.length || 0} sales reps
          </p>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Add Rep
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Rep</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commissionPercent">Default Commission %</Label>
                  <Input
                    id="commissionPercent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.commissionPercent}
                    onChange={(e) => setFormData({ ...formData, commissionPercent: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createRepMutation.isPending}>
                  {createRepMutation.isPending ? 'Creating...' : 'Create Rep'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : reps?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No reps yet. Create your first rep to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reps?.map((rep) => (
              <Card key={rep.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{rep.profile?.full_name || 'Unnamed'}</p>
                    <p className="text-sm text-muted-foreground">{rep.profile?.email}</p>
                    <p className="text-sm text-primary">{rep.default_commission_percent}% commission</p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={editingRep?.id === rep.id} onOpenChange={(open) => {
                      if (!open) setEditingRep(null);
                      else {
                        setEditingRep(rep);
                        setFormData({ ...formData, commissionPercent: rep.default_commission_percent.toString() });
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Rep</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleUpdate} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={rep.profile?.full_name || ''} disabled />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input value={rep.profile?.email || ''} disabled />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="editCommission">Default Commission %</Label>
                            <Input
                              id="editCommission"
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={formData.commissionPercent}
                              onChange={(e) => setFormData({ ...formData, commissionPercent: e.target.value })}
                              required
                            />
                          </div>
                          <Button type="submit" className="w-full" disabled={updateRepMutation.isPending}>
                            {updateRepMutation.isPending ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this rep?')) {
                          deleteRepMutation.mutate(rep.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
