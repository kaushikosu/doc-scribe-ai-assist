import React from "react";
import { CheckCircle2, FileText, Loader2, Mic, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusType =
  | "ready"
  | "recording"
  | "processing"
  | "classifying"
  | "classified"
  | "generating"
  | "generated"
  | "error";

interface StatusBannerProps {
  status: { type: StatusType; message?: string };
}

const iconMap: Record<StatusType, React.ReactNode> = {
  ready: <FileText className="h-4 w-4" />,
  recording: <Mic className="h-4 w-4" />,
  processing: <Loader2 className="h-4 w-4 animate-spin" />,
  classifying: <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />,
  classified: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
  generating: <Loader2 className="h-4 w-4 animate-spin text-green-500" />,
  generated: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  error: <TriangleAlert className="h-4 w-4" />,
};

const badgeDot: Record<StatusType, string> = {
  ready: "bg-doctor-primary",
  recording: "bg-destructive",
  processing: "bg-doctor-secondary",
  classifying: "bg-doctor-secondary",
  classified: "bg-blue-500",
  generating: "bg-doctor-secondary",
  generated: "bg-doctor-primary",
  error: "bg-destructive",
};

export default function StatusBanner({ status }: StatusBannerProps) {

  const message =
    status.message ||
    {
      recording: "Recording in progress",
      processing: "Updating transcript...",
      classifying: "Classifying speakers...",
      classified: "Speakers classified",
      updated: "Transcript updated",
      generating: "Generating prescription...",
      ready: "Prescription ready",
      error: "Something went wrong",
    }[status.type];

  return (
    <div className="fixed bottom-4 right-4 z-50 px-3 sm:px-0">
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
