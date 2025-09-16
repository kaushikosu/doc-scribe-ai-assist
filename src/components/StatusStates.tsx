// src/components/StatusStates.tsx
// Centralized status state definitions and helper for the status bar

import React from 'react';
import { Loader2, Check, Mic, Edit, AlertTriangle, FileText } from 'lucide-react';

export type StatusType =
  | 'ready'
  | 'recording'
  | 'processing'
  | 'classifying'
  | 'classified'
  | 'generating'
  | 'generated'
  | 'error';

export interface StatusBarState {
  type: StatusType;
  message?: string;
  icon?: React.ReactNode;
  color?: string;
}

export const STATUS_CONFIG: Record<StatusType, Omit<StatusBarState, 'type'>> = {
  ready: {
    message: 'Ready',
    icon: <Check className="h-5 w-5 text-green-600" />, color: 'green'
  },
  recording: {
    message: 'Recording in progress',
    icon: <Mic className="h-5 w-5 text-blue-500 animate-pulse" />, color: 'blue'
  },
  processing: {
    message: 'Processing audio...',
    icon: <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />, color: 'yellow'
  },
  classifying: {
    message: 'Classifying speakers...',
    icon: <Edit className="h-5 w-5 text-indigo-500 animate-pulse" />, color: 'indigo'
  },
  classified: {
    message: 'Speakers classified',
    icon: <Check className="h-5 w-5 text-blue-600" />, color: 'blue'
  },
  generating: {
    message: 'Generating prescription...',
    icon: <Loader2 className="h-5 w-5 text-green-500 animate-spin" />, color: 'green'
  },
    generated: {
      message: 'Generated prescription',
      icon: <Check className="h-5 w-5 text-green-600" />, color: 'green'
    },
  error: {
    message: 'Error',
    icon: <AlertTriangle className="h-5 w-5 text-red-500" />, color: 'red'
  },
};

export function getStatusBarState(type: StatusType, customMessage?: string): StatusBarState {
  const config = STATUS_CONFIG[type];
  return {
    type,
    message: customMessage || config.message,
    icon: config.icon,
    color: config.color,
  };
}
