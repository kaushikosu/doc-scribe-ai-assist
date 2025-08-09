import React from "react";
import { cn } from "@/lib/utils";

export type ProgressStep = "recording" | "processing" | "generating" | "generated";

interface StatusStepsBarProps {
  currentStep: ProgressStep;
  className?: string;
}

const steps: { key: ProgressStep; label: string }[] = [
  { key: "recording", label: "Recording Conversation" },
  { key: "processing", label: "Updating Transcription" },
  { key: "generating", label: "Generating Prescription" },
  { key: "generated", label: "Generated Prescription" },
];

export default function StatusStepsBar({ currentStep, className }: StatusStepsBarProps) {
  const activeIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className={cn("mb-6", className)}>
      <nav aria-label="Progress" className="rounded-xl border bg-background/90 backdrop-blur shadow-md p-3 sm:p-4">
        <ol className="grid grid-cols-4 gap-2 sm:gap-3">
          {steps.map((step, idx) => {
            const isDone = idx < activeIndex;
            const isActive = idx === activeIndex;
            return (
              <li key={step.key} className="flex items-center gap-2">
                <div
                  className={cn(
                    "relative flex items-center w-full",
                    idx < steps.length - 1 && "pr-2"
                  )}
                >
                  {/* Dot */}
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium",
                      isDone && "bg-doctor-primary text-white border-doctor-primary",
                      isActive && "bg-doctor-secondary text-white border-doctor-secondary animate-pulse",
                      !isDone && !isActive && "bg-muted text-foreground/70 border-border"
                    )}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {isDone ? "✓" : idx + 1}
                  </div>

                  {/* Connector */}
                  {idx < steps.length - 1 && (
                    <div className="absolute left-7 right-0 h-1 rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-1 rounded-full transition-all",
                          (isDone || isActive) ? "bg-doctor-primary" : "bg-muted"
                        )}
                        style={{ width: isDone ? "100%" : isActive ? "50%" : "0%" }}
                      />
                    </div>
                  )}
                </div>
                <span className={cn(
                  "text-xs sm:text-sm font-medium truncate",
                  isActive ? "text-doctor-secondary" : isDone ? "text-doctor-primary" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
