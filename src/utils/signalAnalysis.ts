import { ChannelStats } from '../types';

export function computeStatistics(
  yValues: number[],
  xValues?: number[]
): ChannelStats {
  const n = yValues.length;
  if (n === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      rms: 0,
      peakToPeak: 0,
      sampleCount: 0,
    };
  }

  let min = yValues[0];
  let max = yValues[0];
  let sum = 0;
  let sumSq = 0;

  for (let i = 0; i < n; i++) {
    const val = yValues[i];
    if (val < min) min = val;
    if (val > max) max = val;
    sum += val;
    sumSq += val * val;
  }

  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  const stdDev = Math.sqrt(variance);
  const rms = Math.sqrt(sumSq / n);
  const peakToPeak = max - min;

  // Approximate median (sample subset for speed if n is huge)
  let median = mean;
  if (n < 50000) {
    const sorted = [...yValues].sort((a, b) => a - b);
    const mid = Math.floor(n / 2);
    median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  let samplingRateApprox: number | undefined;
  if (xValues && xValues.length > 1) {
    const totalTime = Math.abs(xValues[xValues.length - 1] - xValues[0]);
    if (totalTime > 0) {
      samplingRateApprox = (xValues.length - 1) / totalTime;
    }
  }

  return {
    min,
    max,
    mean,
    median,
    stdDev,
    rms,
    peakToPeak,
    sampleCount: n,
    samplingRateApprox,
  };
}

/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm
 * Preserves visual peaks, valleys, and waveform shape while reducing points to targetPoints.
 */
export function lttbDownsample(
  x: number[],
  y: number[],
  targetPoints: number
): { x: number[]; y: number[] } {
  const n = x.length;
  if (targetPoints >= n || targetPoints <= 2) {
    return { x, y };
  }

  const sampledX: number[] = new Array(targetPoints);
  const sampledY: number[] = new Array(targetPoints);

  const bucketSize = (n - 2) / (targetPoints - 2);

  let aIndex = 0;
  sampledX[0] = x[aIndex];
  sampledY[0] = y[aIndex];

  for (let i = 0; i < targetPoints - 2; i++) {
    // Calculate point average for next bucket (c)
    let avgX = 0;
    let avgY = 0;
    const avgStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);
    const avgCount = avgEnd - avgStart;

    for (let j = avgStart; j < avgEnd; j++) {
      avgX += x[j];
      avgY += y[j];
    }
    avgX /= avgCount || 1;
    avgY /= avgCount || 1;

    // Get range for current bucket (b)
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, n);

    // Point a
    const pointAX = x[aIndex];
    const pointAY = y[aIndex];

    let maxArea = -1;
    let nextAIndex = rangeStart;

    for (let j = rangeStart; j < rangeEnd; j++) {
      // Triangle area: 0.5 * |xA(yB - yC) + xB(yC - yA) + xC(yA - yB)|
      const area = Math.abs(
        (pointAX - avgX) * (y[j] - pointAY) - (pointAX - x[j]) * (avgY - pointAY)
      );

      if (area > maxArea) {
        maxArea = area;
        nextAIndex = j;
      }
    }

    sampledX[i + 1] = x[nextAIndex];
    sampledY[i + 1] = y[nextAIndex];
    aIndex = nextAIndex;
  }

  sampledX[targetPoints - 1] = x[n - 1];
  sampledY[targetPoints - 1] = y[n - 1];

  return { x: sampledX, y: sampledY };
}

/**
 * Moving Average Filter
 */
export function computeMovingAverage(yValues: number[], windowSize: number): number[] {
  const n = yValues.length;
  if (windowSize <= 1 || n === 0) return [...yValues];

  const half = Math.floor(windowSize / 2);
  const result = new Array(n);
  let currentSum = 0;

  // Initialize first window
  for (let i = 0; i < Math.min(windowSize, n); i++) {
    currentSum += yValues[i];
  }

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(n - 1, i + half);
    let sum = 0;
    for (let j = start; j <= end; j++) {
      sum += yValues[j];
    }
    result[i] = sum / (end - start + 1);
  }

  return result;
}

/**
 * Numerical Derivative (dY/dX) using central difference
 */
export function computeDerivative(xValues: number[], yValues: number[]): number[] {
  const n = yValues.length;
  if (n <= 1) return new Array(n).fill(0);

  const result = new Array(n);
  // Forward difference for first
  result[0] = (yValues[1] - yValues[0]) / ((xValues[1] - xValues[0]) || 1);

  // Central difference for interior
  for (let i = 1; i < n - 1; i++) {
    const dx = xValues[i + 1] - xValues[i - 1];
    result[i] = (yValues[i + 1] - yValues[i - 1]) / (dx || 1);
  }

  // Backward difference for last
  result[n - 1] = (yValues[n - 1] - yValues[n - 2]) / ((xValues[n - 1] - xValues[n - 2]) || 1);

  return result;
}

/**
 * Numerical Integration (Trapezoidal rule)
 */
export function computeIntegral(xValues: number[], yValues: number[]): number[] {
  const n = yValues.length;
  const result = new Array(n).fill(0);
  if (n <= 1) return result;

  let sum = 0;
  for (let i = 1; i < n; i++) {
    const dx = xValues[i] - xValues[i - 1];
    const avgY = (yValues[i] + yValues[i - 1]) / 2;
    sum += avgY * dx;
    result[i] = sum;
  }
  return result;
}

/**
 * Min-Max Normalization to [0, 1]
 */
export function normalizeValues(yValues: number[]): number[] {
  const n = yValues.length;
  if (n === 0) return [];
  let min = yValues[0];
  let max = yValues[0];
  for (let i = 0; i < n; i++) {
    if (yValues[i] < min) min = yValues[i];
    if (yValues[i] > max) max = yValues[i];
  }
  const range = max - min;
  if (range === 0) return new Array(n).fill(0.5);
  return yValues.map((v) => (v - min) / range);
}

/**
 * Fast Fourier Transform (FFT) Power Spectrum
 * Cooley-Tukey Radix-2 FFT with Hanning window to minimize spectral leakage
 */
export function computeFFT(
  yValues: number[],
  samplingRate: number
): { frequencies: number[]; magnitudes: number[] } {
  const n = yValues.length;
  if (n < 4) {
    return { frequencies: [0], magnitudes: [0] };
  }

  // Find largest power of 2 <= n (cap at 8192 for high interactive responsiveness)
  let p = 1;
  while (p * 2 <= Math.min(n, 8192)) {
    p *= 2;
  }

  const real = new Float64Array(p);
  const imag = new Float64Array(p);

  // Apply Hanning Window to prevent spectral leakage
  for (let i = 0; i < p; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (p - 1)));
    real[i] = yValues[i] * window;
    imag[i] = 0;
  }

  // Bit reversal permutation
  let j = 0;
  for (let i = 0; i < p - 1; i++) {
    if (i < j) {
      const tempR = real[i];
      const tempI = imag[i];
      real[i] = real[j];
      imag[i] = imag[j];
      real[j] = tempR;
      imag[j] = tempI;
    }
    let k = p >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey Radix-2
  for (let len = 2; len <= p; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < p; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < halfLen; k++) {
        const uR = real[i + k];
        const uI = imag[i + k];
        const vR = real[i + k + halfLen] * wR - imag[i + k + halfLen] * wI;
        const vI = real[i + k + halfLen] * wI + imag[i + k + halfLen] * wR;

        real[i + k] = uR + vR;
        imag[i + k] = uI + vI;
        real[i + k + halfLen] = uR - vR;
        imag[i + k + halfLen] = uI - vI;

        const nextWR = wR * wStepR - wI * wStepI;
        const nextWI = wR * wStepI + wI * wStepR;
        wR = nextWR;
        wI = nextWI;
      }
    }
  }

  // Return one-sided spectrum (frequencies up to Nyquist = samplingRate / 2)
  const halfP = p / 2;
  const frequencies: number[] = new Array(halfP);
  const magnitudes: number[] = new Array(halfP);

  const freqStep = samplingRate / p;
  for (let i = 0; i < halfP; i++) {
    frequencies[i] = i * freqStep;
    // Magnitude normalized
    const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / (p / 2);
    magnitudes[i] = i === 0 ? mag / 2 : mag;
  }

  return { frequencies, magnitudes };
}

/**
 * Format numbers cleanly for axis labels and tooltips
 */
export function formatScientificOrFixed(val: number, precision: number = 3): string {
  if (isNaN(val)) return 'NaN';
  if (!isFinite(val)) return val > 0 ? '+Inf' : '-Inf';
  if (val === 0) return '0';

  const abs = Math.abs(val);
  if (abs >= 1e6 || (abs < 0.001 && abs > 0)) {
    return val.toExponential(precision - 1);
  }
  if (abs >= 1000) {
    return val.toFixed(1);
  }
  if (abs >= 1) {
    return val.toFixed(precision);
  }
  return val.toFixed(precision + 1);
}
