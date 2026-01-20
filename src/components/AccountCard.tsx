import { cn } from '@/lib/utils';

interface AccountCardProps {
  merchantName: string;
  profit?: number;
  repPercent: number;
  payoutAmount: number;
  showProfit?: boolean;
  className?: string;
}

export function AccountCard({
  merchantName,
  profit,
  repPercent,
  payoutAmount,
  showProfit = false,
  className
}: AccountCardProps) {
  return (
    <div className={cn('rounded-xl bg-card p-4 shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="truncate font-medium text-foreground">{merchantName}</h3>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{repPercent}%</span>
            {showProfit && profit !== undefined && (
              <>
                <span>•</span>
                <span className={profit < 0 ? 'text-destructive' : ''}>
                  ${profit.toLocaleString('en-US', { minimumFractionDigits: 2 })} profit
                </span>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className={cn(
            'text-lg font-bold',
            payoutAmount < 0 ? 'text-destructive' : 'text-foreground'
          )}>
            ${payoutAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  );
}
