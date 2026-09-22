export interface ChannelStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  rms: number;
  peakToPeak: number;
  sampleCount: number;
  samplingRateApprox?: number; // samples per second if time-based
}

export interface DataChannel {
  id: string;
  fileId: string;
  fileName: string;
  name: string;
  unit: string;
  xLabel: string;
  yLabel: string;
  xValues: number[];
  yValues: number[];
  stats: ChannelStats;
  color: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: 'tdms' | 'csv' | 'txt';
  timestamp: number;
  channelIds: string[];
  metadata?: Record<string, string>;
}

export type InteractionMode = 'select' | 'pan' | 'cursor';
export type AnalysisMode = 'raw' | 'fft' | 'smooth' | 'derivative' | 'integral' | 'normalized';
export type YAxisScaleMode = 'auto' | 'unified' | 'normalized';

export interface GraphViewConfig {
  id: string;
  title: string;
  channelIds: string[]; // channels plotted in this view (supports superposition)
  hiddenChannelIds: string[]; // toggled off in legend
  xDomain: [number, number] | null; // null = full extent
  yDomain: [number, number] | null;
  historyStack: Array<{ xDomain: [number, number]; yDomain: [number, number] }>; // for right-click step-back undo
  mode: InteractionMode;
  analysisMode: AnalysisMode;
  smoothingWindow: number; // e.g. 5, 11, 21
  yAxisScaleMode: YAxisScaleMode;
  showDualCursor: boolean;
  cursorA: number | null; // X coordinate
  cursorB: number | null;
  showGrid: boolean;
}

export type GridLayout = 1 | 2 | 3 | 4 | 5 | 6;

export interface AppTheme {
  isDark: boolean;
}
