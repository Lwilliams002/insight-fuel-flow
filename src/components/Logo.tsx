import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export function Logo({ className, size = 'md', showText = false }: LogoProps) {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
    xl: 'h-12 w-12',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(sizes[size], 'flex-shrink-0')}
      >
        {/* Abstract roof shape with gradient */}
        <defs>
          <linearGradient id="roofGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(187, 100%, 50%)" />
            <stop offset="100%" stopColor="hsl(187, 100%, 35%)" />
          </linearGradient>
          <linearGradient id="accentGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(24, 100%, 50%)" />
            <stop offset="100%" stopColor="hsl(24, 100%, 60%)" />
          </linearGradient>
        </defs>
        
        {/* Main roof peak */}
        <path
          d="M24 6L4 28H12V42H36V28H44L24 6Z"
          fill="url(#roofGradient)"
        />
        
        {/* Accent line under the peak */}
        <path
          d="M24 10L8 26H16L24 17L32 26H40L24 10Z"
          fill="url(#accentGradient)"
          opacity="0.9"
        />
        
        {/* Chimney detail */}
        <rect
          x="30"
          y="14"
          width="6"
          height="10"
          fill="hsl(0, 0%, 20%)"
          rx="1"
        />
      </svg>
      
      {showText && (
        <div className="flex flex-col">
          <span className={cn('font-bold text-foreground leading-tight', textSizes[size])}>
            RoofCommission
          </span>
          <span className="text-xs text-primary font-medium tracking-wider">PRO</span>
        </div>
      )}
    </div>
  );
}
