import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repsApi, adminApi } from '@/integrations/aws/api';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw, GraduationCap, CheckCircle } from 'lucide-react';

type CommissionLevel = 'junior' | 'senior' | 'manager';

interface CommissionLevelInfo {
  level: CommissionLevel;
  display_name: string;
  commission_percent: number;
  description: string;
}

interface Rep {
  id: string;
  user_id: string;
  commission_level: CommissionLevel;
  default_commission_percent: number;
  training_completed: boolean;
  profile: {
    full_name: string | null;
    email: string;
  } | null;
}

const levelColors: Record<CommissionLevel, string> = {
  'junior': 'bg-[#4A6FA5]/20 text-[#4A6FA5] border-[#4A6FA5]/30',   // Prime Steel Blue
  'senior': 'bg-[#C9A24D]/20 text-[#C9A24D] border-[#C9A24D]/30',   // Prime Gold
  'manager': 'bg-[#C9A24D]/30 text-[#C9A24D] border-[#C9A24D]/50',  // Prime Gold (stronger)
};

export default function RepsManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<Rep | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    commissionLevel: 'junior' as CommissionLevel,
  });
  const queryClient = useQueryClient();

  const { data: levels } = useQuery({
    queryKey: ['commission-levels'],
    queryFn: async () => {
      // Commission levels matching database enum
      return [
        { level: 'junior', display_name: 'Junior', commission_percent: 5, description: 'Entry level' },
        { level: 'senior', display_name: 'Senior', commission_percent: 10, description: 'Experienced rep' },
        { level: 'manager', display_name: 'Manager', commission_percent: 13, description: 'Team manager' },
      ] as CommissionLevelInfo[];
    },
  });

  const { data: reps, isLoading } = useQuery({
    queryKey: ['reps'],
    queryFn: async () => {
      const response = await repsApi.list();
      if (response.error) throw new Error(response.error);
      return (response.data || []).map(rep => ({
        id: rep.id,
        user_id: rep.user_id,
        commission_level: (rep.commission_level || 'junior') as CommissionLevel,
        default_commission_percent: rep.default_commission_percent || 10,
        training_completed: rep.training_completed || false,
        profile: {
          full_name: rep.full_name,
          email: rep.email,
        },
      })) as Rep[];
    },
  });

  const createRepMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await adminApi.createRep({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        commissionLevel: data.commissionLevel,
      });

      if (response.error) {
        throw new Error(response.error);
      }
      
      return response.data;
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
    mutationFn: async ({ repId, commissionLevel }: { repId: string; commissionLevel: CommissionLevel }) => {
      const response = await repsApi.update(repId, { commission_level: commissionLevel });
      if (response.error) throw new Error(response.error);
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
      const response = await repsApi.delete(repId);
      if (response.error) throw new Error(response.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      toast.success('Rep deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete rep: ' + error.message);
    },
  });

  const syncRepsMutation = useMutation({
    mutationFn: async () => {
      const response = await adminApi.syncReps();
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      toast.success(data?.message || 'Reps synced successfully');
    },
    onError: (error) => {
      toast.error('Failed to sync reps: ' + error.message);
    },
  });

  const completeTrainingMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await adminApi.completeTraining(email);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reps'] });
      toast.success(data?.message || 'Training marked as complete');
    },
    onError: (error) => {
      toast.error('Failed to complete training: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      commissionLevel: 'junior',
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
      commissionLevel: formData.commissionLevel,
    });
  };

  const getLevelInfo = (level: CommissionLevel) => 
    levels?.find(l => l.level === level);

  return (
    <AdminLayout title="Manage Reps">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            {reps?.length || 0} sales reps
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => syncRepsMutation.mutate()}
              disabled={syncRepsMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncRepsMutation.isPending ? 'animate-spin' : ''}`} />
              {syncRepsMutation.isPending ? 'Syncing...' : 'Sync from Cognito'}
            </Button>
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
                  <Label htmlFor="commissionLevel">Commission Level</Label>
                  <Select 
                    value={formData.commissionLevel} 
                    onValueChange={(v) => setFormData({ ...formData, commissionLevel: v as CommissionLevel })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {levels?.map((level) => (
                        <SelectItem key={level.level} value={level.level}>
                          <div className="flex items-center gap-2">
                            <span>{level.display_name}</span>
                            <span className="text-muted-foreground">({level.commission_percent}%)</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {getLevelInfo(formData.commissionLevel)?.description}
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={createRepMutation.isPending}>
                  {createRepMutation.isPending ? 'Creating...' : 'Create Rep'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
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
            {reps?.map((rep) => {
              const levelInfo = getLevelInfo(rep.commission_level);
              return (
              <Card key={rep.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <p className="font-medium">{rep.profile?.full_name || 'Unnamed'}</p>
                    <p className="text-sm text-muted-foreground">{rep.profile?.email}</p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className={levelColors[rep.commission_level]}>
                        {levelInfo?.display_name || rep.commission_level} ({levelInfo?.commission_percent || rep.default_commission_percent}%)
                      </Badge>
                      {rep.training_completed ? (
                        <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Training Complete
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-orange-500/20 text-orange-500 border-orange-500/30">
                          Training Required
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!rep.training_completed && rep.profile?.email && (
                      <Button
                        variant="outline"
                        size="icon"
                        title="Complete Training"
                        onClick={() => {
                          if (confirm(`Mark training as complete for ${rep.profile?.full_name || rep.profile?.email}?`)) {
                            completeTrainingMutation.mutate(rep.profile!.email);
                          }
                        }}
                        disabled={completeTrainingMutation.isPending}
                      >
                        <GraduationCap className="h-4 w-4" />
                      </Button>
                    )}
                    <Dialog open={editingRep?.id === rep.id} onOpenChange={(open) => {
                      if (!open) setEditingRep(null);
                      else {
                        setEditingRep(rep);
                        setFormData({ ...formData, commissionLevel: rep.commission_level });
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
                            <Label>Commission Level</Label>
                            <Select 
                              value={formData.commissionLevel} 
                              onValueChange={(v) => setFormData({ ...formData, commissionLevel: v as CommissionLevel })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select level" />
                              </SelectTrigger>
                              <SelectContent>
                                {levels?.map((level) => (
                                  <SelectItem key={level.level} value={level.level}>
                                    <div className="flex items-center gap-2">
                                      <span>{level.display_name}</span>
                                      <span className="text-muted-foreground">({level.commission_percent}%)</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {getLevelInfo(formData.commissionLevel)?.description}
                            </p>
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
            );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

