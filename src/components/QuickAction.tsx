import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionProps {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
  variant?: 'default' | 'primary' | 'accent';
}

export function QuickAction({ href, icon: Icon, label, description, variant = 'default' }: QuickActionProps) {
  return (
    <Link to={href} className="block group">
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all',
          'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5',
          'group-hover:-translate-y-0.5'
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors',
              variant === 'default' && 'bg-muted group-hover:bg-primary/10',
              variant === 'primary' && 'bg-primary/10',
              variant === 'accent' && 'bg-accent/10'
            )}
          >
            <Icon
              className={cn(
                'h-6 w-6 transition-colors',
                variant === 'default' && 'text-muted-foreground group-hover:text-primary',
                variant === 'primary' && 'text-primary',
                variant === 'accent' && 'text-accent'
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {label}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
