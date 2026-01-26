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
        {/* Prime Roofing Logo - Navy with Gold accent */}
        <defs>
          <linearGradient id="navyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F1E2E" />
            <stop offset="100%" stopColor="#1a2d42" />
          </linearGradient>
          <linearGradient id="goldGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C9A24D" />
            <stop offset="100%" stopColor="#d4b366" />
          </linearGradient>
        </defs>
        
        {/* Main roof peak - Navy */}
        <path
          d="M24 6L4 28H12V42H36V28H44L24 6Z"
          fill="url(#navyGradient)"
        />
        
        {/* Accent line under the peak - Gold */}
        <path
          d="M24 10L8 26H16L24 17L32 26H40L24 10Z"
          fill="url(#goldGradient)"
          opacity="0.95"
        />
        
        {/* Chimney detail */}
        <rect
          x="30"
          y="14"
          width="6"
          height="10"
          fill="#0F1E2E"
          rx="1"
        />
      </svg>
      
      {showText && (
        <div className="flex flex-col">
          <span className={cn('font-bold text-foreground leading-tight', textSizes[size])}>
            Titan Prime
          </span>
          <span className="text-xs text-primary font-medium tracking-wider">SOLUTIONS</span>
        </div>
      )}
    </div>
  );
}
