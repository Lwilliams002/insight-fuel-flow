import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'accent';
}

export function StatCard({ title, value, icon: Icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30',
        variant === 'primary' && 'border-primary/20 bg-primary/5',
        variant === 'accent' && 'border-accent/20 bg-accent/5'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {trend && (
            <p
              className={cn(
                'text-xs font-medium',
                trend.isPositive ? 'text-primary' : 'text-destructive'
              )}
            >
              {trend.isPositive ? '+' : ''}{trend.value}% from last month
            </p>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-lg',
            variant === 'default' && 'bg-muted',
            variant === 'primary' && 'bg-primary/10',
            variant === 'accent' && 'bg-accent/10'
          )}
        >
          <Icon
            className={cn(
              'h-5 w-5',
              variant === 'default' && 'text-muted-foreground',
              variant === 'primary' && 'text-primary',
              variant === 'accent' && 'text-accent'
            )}
          />
        </div>
      </div>
      
      {/* Decorative gradient */}
      <div
        className={cn(
          'absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-2xl',
          variant === 'default' && 'bg-muted-foreground',
          variant === 'primary' && 'bg-primary',
          variant === 'accent' && 'bg-accent'
        )}
      />
    </div>
  );
}
