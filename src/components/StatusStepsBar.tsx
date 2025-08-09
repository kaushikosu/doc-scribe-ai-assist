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
    <div className={cn("mb-4 sm:mb-6", className)}>
      <nav aria-label="Progress" className="rounded-xl border border-doctor-primary/20 bg-card text-card-foreground shadow-lg p-3 sm:p-4">
        <ol className="grid grid-cols-4 gap-3">
          {steps.map((step, idx) => {
            const isDone = idx < activeIndex;
            const isActive = idx === activeIndex;
            return (
              <li key={step.key} className="flex items-center gap-3 min-w-0">
                <div className={cn("relative flex items-center w-full", idx < steps.length - 1 && "pr-3") }>
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border text-xs sm:text-sm font-semibold",
                      isDone && "bg-doctor-primary text-white border-doctor-primary",
                      isActive && "bg-doctor-secondary text-white border-doctor-secondary animate-pulse",
                      !isDone && !isActive && "bg-muted text-foreground border-border"
                    )}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {isDone ? "✓" : idx + 1}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="absolute left-8 right-0 h-1.5 rounded-full bg-border">
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          (isDone || isActive) ? "bg-doctor-primary" : "bg-muted/70"
                        )}
                        style={{ width: isDone ? "100%" : isActive ? "50%" : "0%" }}
                      />
                    </div>
                  )}
                </div>
                <span className={cn(
                  "text-[11px] sm:text-sm md:text-base font-medium truncate",
                  isActive ? "text-doctor-secondary" : isDone ? "text-doctor-primary" : "text-foreground"
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
