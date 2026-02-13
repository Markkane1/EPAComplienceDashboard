import { Badge } from "@/ui/components/ui/badge";
import type { ApplicationStatus } from "@repo/shared";

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  submitted: { label: "Submitted", variant: "secondary" },
  complete: { label: "Complete", variant: "default" },
  incomplete: { label: "Incomplete", variant: "outline" },
  hearing_scheduled: { label: "Hearing Scheduled", variant: "default" },
  under_hearing: { label: "Under Hearing", variant: "secondary" },
  approved_resolved: { label: "Approved & Resolved", variant: "default" },
  rejected_closed: { label: "Rejected & Closed", variant: "destructive" },
};

interface StatusBadgeProps {
  status: ApplicationStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <Badge 
      variant={config.variant}
      className={status === "approved_resolved" ? "bg-accent text-accent-foreground" : ""}
    >
      {config.label}
    </Badge>
  );
}



