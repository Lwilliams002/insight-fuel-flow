import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AwsAuthContext';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('admin' | 'rep')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
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

  return <>{children}</>;
}
