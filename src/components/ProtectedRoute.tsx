import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AwsAuthContext';
import { repsApi } from '@/integrations/aws/api';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('admin' | 'rep')[];
  skipTrainingCheck?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, skipTrainingCheck = false }: ProtectedRouteProps) {
  const { user, role, loading, signOut } = useAuth();
  const location = useLocation();

  // Fetch rep data to check training status
  const { data: repData, isLoading: repLoading } = useQuery({
    queryKey: ['current-rep'],
    queryFn: async () => {
      const result = await repsApi.list();
      if (result.error) throw new Error(result.error);
      return result.data && result.data.length > 0 ? result.data[0] : null;
    },
    enabled: !!user && role === 'rep',
  });

  if (loading || (role === 'rep' && !skipTrainingCheck && repLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <h1 className="text-xl font-semibold text-foreground">Access Pending</h1>
        <p className="mt-2 text-center text-muted-foreground">
          Your account is awaiting role assignment. Please contact your administrator.
        </p>
        <Button variant="outline" className="mt-4" onClick={signOut}>
          Sign Out
        </Button>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  // Check training completion for reps (except on /learning route)
  if (role === 'rep' && !skipTrainingCheck && repData && !repData.training_completed) {
    return <Navigate to="/learning" replace />;
  }

  return <>{children}</>;
}
