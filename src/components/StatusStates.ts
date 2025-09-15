// src/components/StatusStates.ts
// Centralized status state definitions and helper for the status bar

export type StatusType =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'classifying'
  | 'generating'
  | 'generated'
  | 'ready'
  | 'error';

export interface StatusBarState {
  type: StatusType;
  message?: string;
  icon?: React.ReactNode;
  color?: string;
}

// Map each status type to its default message, icon, and color

import { Loader2, Check, Mic, Edit, AlertTriangle, FileText } from 'lucide-react';
import React from 'react';

// Icon components for status bar
export const IdleIcon = () => <FileText className="h-5 w-5 text-gray-400" />;
export const RecordingIcon = () => <Mic className="h-5 w-5 text-blue-500 animate-pulse" />;
export const ProcessingIcon = () => <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />;
export const ClassifyingIcon = () => <Edit className="h-5 w-5 text-indigo-500 animate-pulse" />;
export const GeneratingIcon = () => <Loader2 className="h-5 w-5 text-green-500 animate-spin" />;
export const GeneratedIcon = () => <Check className="h-5 w-5 text-green-600" />;
export const ReadyIcon = () => <Check className="h-5 w-5 text-green-600" />;
export const ErrorIcon = () => <AlertTriangle className="h-5 w-5 text-red-500" />;

export const STATUS_CONFIG: Record<StatusType, Omit<StatusBarState, 'type'>> = {
  idle: {
    message: 'Idle',
    icon: <IdleIcon />, color: 'gray'
  },
  recording: {
    message: 'Recording in progress',
    icon: <RecordingIcon />, color: 'blue'
  },
  processing: {
    message: 'Processing audio...',
    icon: <ProcessingIcon />, color: 'yellow'
  },
  classifying: {
    message: 'Classifying speakers...',
    icon: <ClassifyingIcon />, color: 'indigo'
  },
  generating: {
    message: 'Generating prescription...',
    icon: <GeneratingIcon />, color: 'green'
  },
  generated: {
    message: 'Prescription generated',
    icon: <GeneratedIcon />, color: 'green'
  },
  ready: {
    message: 'Ready',
    icon: <ReadyIcon />, color: 'green'
  },
  error: {
    message: 'Error',
    icon: <ErrorIcon />, color: 'red'
  },
};

// Helper to get status config
export function getStatusBarState(type: StatusType, customMessage?: string): StatusBarState {
  const config = STATUS_CONFIG[type];
  return {
    type,
    message: customMessage || config.message,
    icon: config.icon,
    color: config.color,
  };
}
