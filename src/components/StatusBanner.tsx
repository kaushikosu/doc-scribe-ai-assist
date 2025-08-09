import React from "react";
import { CheckCircle2, FileText, Loader2, Mic, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusType =
  | "idle"
  | "recording"
  | "processing"
  | "updated"
  | "generating"
  | "ready"
  | "error";

interface StatusBannerProps {
  status: { type: StatusType; message?: string };
}

const iconMap: Record<Exclude<StatusType, "idle">, React.ReactNode> = {
  recording: <Mic className="h-4 w-4" />,
  processing: <Loader2 className="h-4 w-4 animate-spin" />,
  updated: <CheckCircle2 className="h-4 w-4" />,
  generating: <Loader2 className="h-4 w-4 animate-spin" />,
  ready: <FileText className="h-4 w-4" />,
  error: <TriangleAlert className="h-4 w-4" />,
};

const badgeDot: Record<Exclude<StatusType, "idle">, string> = {
  recording: "bg-destructive",
  processing: "bg-doctor-secondary",
  updated: "bg-doctor-primary",
  generating: "bg-doctor-secondary",
  ready: "bg-doctor-primary",
  error: "bg-destructive",
};

export default function StatusBanner({ status }: StatusBannerProps) {
  if (status.type === "idle") return null;

  const message =
    status.message ||
    {
      recording: "Recording in progress",
      processing: "Updating transcript...",
      updated: "Transcript updated",
      generating: "Generating prescription...",
      ready: "Prescription ready",
      error: "Something went wrong",
    }[status.type];

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-3 sm:px-0">
      <div
        className={cn(
          "flex items-center gap-2 sm:gap-3 rounded-full border shadow-lg backdrop-blur",
          "px-4 py-2 sm:px-5 sm:py-2.5",
          "bg-background/90 border-doctor-primary/20 animate-enter"
        )}
        role="status"
        aria-live="polite"
      >
        <span
          className={cn(
            "inline-block h-2.5 w-2.5 rounded-full",
            status.type === "recording" ? "animate-pulse" : "",
            badgeDot[status.type as Exclude<StatusType, "idle">]
          )}
        />
        <span className="text-sm font-medium flex items-center gap-2">
          {iconMap[status.type as Exclude<StatusType, "idle">]}
          {message}
        </span>
      </div>
    </div>
  );
}
