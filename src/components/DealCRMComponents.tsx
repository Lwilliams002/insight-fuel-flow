import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DealStatus,
  dealStatusConfig,
  getProgressPercentage,
  phaseConfig,
  getPhaseForStatus,
  CRMPhase
} from '@/lib/crmProcess';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Shield
} from 'lucide-react';

interface DealPipelineProps {
  currentStatus: DealStatus;
  onStatusChange?: (newStatus: DealStatus) => void;
  deal?: {
    homeowner_name?: string;
    address?: string;
    rcv?: number;
    acv?: number;
    depreciation?: number;
    deductible?: number;
    insurance_company?: string;
    claim_number?: string;
  };
}

export function DealPipeline({ currentStatus, onStatusChange, deal }: DealPipelineProps) {
  const config = dealStatusConfig[currentStatus];
  const progress = getProgressPercentage(currentStatus);
  const currentPhase = getPhaseForStatus(currentStatus);

  const phases: CRMPhase[] = ['sign', 'build', 'collect'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Deal Progress</CardTitle>
          <Badge
            style={{ backgroundColor: config.color, color: 'white' }}
          >
            {config.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Phase Indicators */}
        <div className="flex items-center justify-between py-2">
          {phases.map((phase, index) => {
            const phaseInfo = phaseConfig[phase];
            const isActive = currentPhase === phase;
            const isComplete = phases.indexOf(currentPhase) > index;

            return (
              <div key={phase} className="flex items-center">
                <div className={cn(
                  "flex flex-col items-center gap-1",
                  isActive && "scale-110"
                )}>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all",
                    isComplete ? "bg-green-500 text-white" :
                    isActive ? "bg-primary text-white" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {isComplete ? <CheckCircle2 className="h-5 w-5" /> : phaseInfo.icon}
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {phaseInfo.label}
                  </span>
                </div>
                {index < phases.length - 1 && (
                  <ChevronRight className={cn(
                    "h-5 w-5 mx-2",
                    isComplete ? "text-green-500" : "text-muted-foreground"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Next Action */}
        {config.actionLabel && config.nextStatus && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Next Step</p>
                <p className="text-xs text-muted-foreground">{config.actionLabel}</p>
              </div>
              {onStatusChange && (
                <Button
                  size="sm"
                  onClick={() => onStatusChange(config.nextStatus!)}
                >
                  {config.actionLabel}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface InsuranceCardProps {
  rcv?: number;
  acv?: number;
  depreciation?: number;
  deductible?: number;
  insuranceCompany?: string;
  claimNumber?: string;
  acvCollected?: boolean;
  depreciationCollected?: boolean;
}

export function InsuranceCard({
  rcv = 0,
  acv = 0,
  depreciation = 0,
  deductible = 0,
  insuranceCompany,
  claimNumber,
  acvCollected = false,
  depreciationCollected = false,
}: InsuranceCardProps) {
  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Insurance Details</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Insurance Info */}
        {(insuranceCompany || claimNumber) && (
          <div className="grid grid-cols-2 gap-4">
            {insuranceCompany && (
              <div>
                <p className="text-xs text-muted-foreground">Insurance Company</p>
                <p className="font-medium text-sm">{insuranceCompany}</p>
              </div>
            )}
            {claimNumber && (
              <div>
                <p className="text-xs text-muted-foreground">Claim Number</p>
                <p className="font-medium text-sm">{claimNumber}</p>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Payment Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-sm">RCV (Total Claim)</span>
            </div>
            <span className="font-bold">{formatCurrency(rcv)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-sm">Depreciation (Held Back)</span>
            </div>
            <span className="font-medium text-orange-600">-{formatCurrency(depreciation)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm">ACV (After Depreciation)</span>
            </div>
            <span className="font-medium">{formatCurrency(acv)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm">Deductible (Homeowner Pays)</span>
            </div>
            <span className="font-medium text-red-600">-{formatCurrency(deductible)}</span>
          </div>

          <Separator />

          {/* Checks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                {acvCollected ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">1st Check (ACV - Deductible)</span>
              </div>
              <span className="font-bold">{formatCurrency(acv - deductible)}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                {depreciationCollected ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">2nd Check (Depreciation)</span>
              </div>
              <span className="font-bold">{formatCurrency(depreciation)}</span>
            </div>
          </div>
        </div>

        {/* Formula Reminder */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs text-muted-foreground text-center">
            ACV + Deductible + Depreciation = RCV
          </p>
          <p className="text-xs text-center font-medium mt-1">
            {formatCurrency(acv)} + {formatCurrency(deductible)} + {formatCurrency(depreciation)} = {formatCurrency(rcv)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatusTimelineProps {
  currentStatus: DealStatus;
  statusHistory?: { status: DealStatus; date: Date }[];
}

export function StatusTimeline({ currentStatus, statusHistory = [] }: StatusTimelineProps) {
  const allStatuses: DealStatus[] = [
    'lead', 'inspection_scheduled', 'claim_filed', 'adjuster_scheduled',
    'adjuster_met', 'approved', 'signed', 'materials_ordered',
    'materials_delivered', 'install_scheduled', 'installed',
    'invoice_sent', 'depreciation_collected', 'complete'
  ];

  const currentIndex = allStatuses.indexOf(currentStatus);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Status Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {allStatuses.map((status, index) => {
            const config = dealStatusConfig[status];
            const isComplete = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isPending = index > currentIndex;
            const historyEntry = statusHistory.find(h => h.status === status);

            return (
              <div key={status} className="flex gap-3 pb-4 last:pb-0">
                {/* Line */}
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-3 h-3 rounded-full border-2",
                    isComplete ? "bg-green-500 border-green-500" :
                    isCurrent ? "bg-primary border-primary" :
                    "bg-background border-muted-foreground"
                  )} />
                  {index < allStatuses.length - 1 && (
                    <div className={cn(
                      "w-0.5 flex-1 min-h-[20px]",
                      isComplete ? "bg-green-500" : "bg-muted"
                    )} />
                  )}
                </div>

                {/* Content */}
                <div className={cn(
                  "flex-1 pb-2",
                  isPending && "opacity-50"
                )}>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-sm font-medium",
                      isCurrent && "text-primary"
                    )}>
                      {config.label}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: config.color,
                        color: config.color
                      }}
                    >
                      {config.phase.toUpperCase()}
                    </Badge>
                  </div>
                  {historyEntry && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {historyEntry.date.toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
