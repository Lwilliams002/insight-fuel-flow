import { cn } from '@/lib/utils';
import logoImage from '@/assets/logo.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export function Logo({ className, size = 'md', showText = false }: LogoProps) {
  const sizes = {
    sm: 'h-6 w-auto max-w-6',
    md: 'h-8 w-auto max-w-8',
    lg: 'h-10 w-auto max-w-10',
    xl: 'h-12 w-auto max-w-12',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img
        src={logoImage}
        alt="Titan Prime Solutions"
        className={cn(sizes[size], 'flex-shrink-0 object-contain rounded')}
      />
      
      {showText && (
        <div className="flex flex-col">
          <span className={cn('font-bold leading-tight', textSizes[size])}>
            <span className="text-prime-gold">PRIME</span>{' '}
            <span className="text-foreground">PROS</span>
          </span>
        </div>
      )}
    </div>
  );
}
