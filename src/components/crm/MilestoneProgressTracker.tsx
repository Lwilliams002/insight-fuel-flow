import { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DealStatus, dealStatusConfig, CRMPhase } from '@/lib/crmProcess';
import { cn } from '@/lib/utils';
import {
  User,
  Search,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  FileSignature,
  Package,
  Truck,
  Wrench,
  Home,
  Send,
  DollarSign,
  Trophy,
} from 'lucide-react';

interface MilestoneProgressTrackerProps {
  currentStatus: DealStatus;
  timestamps?: Record<DealStatus, string | null>;
}

// Milestone order matching the CRM workflow
const milestones: { status: DealStatus; icon: React.ElementType; label: string; phase: CRMPhase }[] = [
  { status: 'lead', icon: User, label: 'Lead', phase: 'sign' },
  { status: 'inspection_scheduled', icon: Search, label: 'Inspection', phase: 'sign' },
  { status: 'claim_filed', icon: FileText, label: 'Claim Filed', phase: 'sign' },
  { status: 'signed', icon: FileSignature, label: 'Signed', phase: 'sign' },
  { status: 'adjuster_met', icon: Clock, label: 'Awaiting Appr.', phase: 'sign' },
  { status: 'approved', icon: CheckCircle2, label: 'Approved', phase: 'sign' },
  { status: 'collect_acv', icon: DollarSign, label: 'Collect ACV', phase: 'build' },
  { status: 'collect_deductible', icon: DollarSign, label: 'Collect Ded.', phase: 'build' },
  { status: 'install_scheduled', icon: Calendar, label: 'Inst. Sched.', phase: 'build' },
  { status: 'installed', icon: Home, label: 'Installed', phase: 'build' },
  { status: 'invoice_sent', icon: Send, label: 'Invoice Sent', phase: 'finalizing' },
  { status: 'depreciation_collected', icon: DollarSign, label: 'Depreciation', phase: 'finalizing' },
  { status: 'complete', icon: Trophy, label: 'Complete', phase: 'finalizing' },
];

// Titan Prime palette
const PRIME_NAVY = '#0F1E2E';
const PRIME_GOLD = '#C9A24D';
const CHARCOAL = '#2E2E2E';

const phaseLabels: Record<CRMPhase, string> = {
  sign: 'SIGNED',
  build: 'INSTALL REVIEW',
  finalizing: 'FINALIZING',
  complete: 'COMPLETE',
  other: '',
};

export function MilestoneProgressTracker({ currentStatus, timestamps }: MilestoneProgressTrackerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Find current milestone index
  const currentIndex = milestones.findIndex(m => m.status === currentStatus);
  const currentConfig = dealStatusConfig[currentStatus];
  
  // Calculate overall progress percentage
  const progressPercent = currentIndex >= 0 
    ? Math.round((currentIndex / (milestones.length - 1)) * 100) 
    : 0;

  // Group milestones by phase for visual dividers
  const getPhaseStartIndex = (phase: CRMPhase) => 
    milestones.findIndex(m => m.phase === phase);

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0 space-y-4">
        {/* Header: Title + Status Badge + Progress % */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-lg text-black dark:text-white">Deal Progress</h2>
            <Badge
              className="text-xs font-medium"
              style={{ backgroundColor: PRIME_GOLD, color: PRIME_NAVY }}
            >
              {currentConfig?.label || currentStatus}
            </Badge>
          </div>
          <span className="text-sm font-semibold" style={{ color: PRIME_GOLD }}>
            {progressPercent}%
          </span>
        </div>

        {/* Subtitle description */}
        <p className="text-sm text-muted-foreground px-1">
          {currentConfig?.description || 'Processing...'}
        </p>

        {/* Horizontal scrollable milestone track */}
        <div className="relative">
          <ScrollArea className="w-full" ref={scrollRef}>
            <div className="flex items-end gap-0 pb-8 pt-14 px-4 min-w-max">
              {milestones.map((milestone, index) => {
                const isComplete = index < currentIndex;
                const isCurrent = index === currentIndex;
                const isFuture = index > currentIndex;
                const Icon = milestone.icon;
                const timestamp = timestamps?.[milestone.status];
                
                // Check if this is the start of a new phase
                const isPhaseStart = index === getPhaseStartIndex(milestone.phase);
                
                return (
                  <div key={milestone.status} className="relative flex flex-col items-center">
                    {/* Phase label at start of each phase */}
                    {isPhaseStart && (
                      <div 
                        className="absolute top-12 left-0 text-[10px] font-bold tracking-wider whitespace-nowrap text-black dark:text-white"
                      >
                        {phaseLabels[milestone.phase]}
                      </div>
                    )}
                    
                    {/* Angled label above node */}
                    <div 
                      className={cn(
                        "absolute -top-6 left-1/2 text-[10px] whitespace-nowrap origin-bottom-left",
                        isCurrent ? "font-semibold" : "font-normal"
                      )}
                      style={{ 
                        transform: 'translateX(-50%) rotate(-45deg)',
                        color: isFuture ? '#9CA3AF' : (isCurrent ? PRIME_GOLD : CHARCOAL),
                      }}
                    >
                      {milestone.label}
                    </div>
                    
                    {/* Node and connection line */}
                    <div className="flex items-center">
                      {/* Line before (except first) */}
                      {index > 0 && (
                        <div 
                          className="h-1 w-8"
                          style={{ 
                            backgroundColor: index <= currentIndex ? PRIME_GOLD : '#E5E7EB' 
                          }}
                        />
                      )}
                      
                      {/* Milestone node */}
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                "relative flex items-center justify-center rounded-full transition-all",
                                isCurrent ? "w-10 h-10 ring-4 ring-[#C9A24D]/40" : "w-8 h-8"
                              )}
                              style={{
                                backgroundColor: isComplete || isCurrent ? PRIME_GOLD : '#F3F4F6',
                                borderColor: isComplete || isCurrent ? PRIME_GOLD : '#D1D5DB',
                                borderWidth: isFuture ? 2 : 0,
                              }}
                            >
                              <Icon 
                                className={cn(
                                  isCurrent ? "w-5 h-5" : "w-4 h-4"
                                )}
                                style={{ 
                                  color: isComplete || isCurrent ? PRIME_NAVY : '#9CA3AF' 
                                }}
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent 
                            side="bottom" 
                            className="text-xs"
                            style={{ backgroundColor: PRIME_NAVY, color: 'white' }}
                          >
                            <p className="font-medium">{milestone.label}</p>
                            {timestamp && (
                              <p className="text-muted-foreground text-[10px]">
                                {new Date(timestamp).toLocaleDateString()}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {/* Line after (except last) */}
                      {index < milestones.length - 1 && (
                        <div 
                          className="h-1 w-8"
                          style={{ 
                            backgroundColor: index < currentIndex ? PRIME_GOLD : '#E5E7EB' 
                          }}
                        />
                      )}
                    </div>

                    {/* Timestamp below node for completed/current milestones */}
                    {(isComplete || isCurrent) && timestamp && (
                      <div className="absolute top-16 left-1/2 text-[8px] whitespace-nowrap text-black dark:text-white font-medium"
                           style={{ transform: 'translateX(-50%)' }}>
                        {new Date(timestamp).toLocaleDateString('en-US', {
                          month: '2-digit',
                          day: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" className="h-2" />
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}