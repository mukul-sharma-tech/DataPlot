import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  Move,
  Hand,
  Crosshair,
  Camera,
  Activity,
  Layers,
  Sliders,
  Eye,
  EyeOff,
  Radio,
} from 'lucide-react';
import { DataChannel, GraphViewConfig, InteractionMode, AnalysisMode } from '../types';
import {
  lttbDownsample,
  computeFFT,
  computeMovingAverage,
  computeDerivative,
  normalizeValues,
  formatScientificOrFixed,
} from '../utils/signalAnalysis';

interface InteractiveCanvasPlotProps {
  view: GraphViewConfig;
  allChannels: DataChannel[];
  isDark: boolean;
  isMaximized: boolean;
  forceStackedHeader?: boolean;
  onToggleMaximize: () => void;
  onUpdateView: (updated: Partial<GraphViewConfig>) => void;
  onRemoveView?: () => void;
}

export const InteractiveCanvasPlot: React.FC<InteractiveCanvasPlotProps> = ({
  view,
  allChannels,
  isDark,
  isMaximized,
  forceStackedHeader = false,
  onToggleMaximize,
  onUpdateView,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Interaction State
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentMouse, setCurrentMouse] = useState<{ x: number; y: number } | null>(null);
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);
  const [panOrigin, setPanOrigin] = useState<{
    mouseX: number;
    mouseY: number;
    xDomain: [number, number];
    yDomain: [number, number];
  } | null>(null);
  const [cursorData, setCursorData] = useState<{ xVal: number; channelValues: Record<string, number> } | null>(null);
  const [undoNotice, setUndoNotice] = useState<string | null>(null);
  const [showChannelSelect, setShowChannelSelect] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const [containerHeight, setContainerHeight] = useState<number>(350);

  // Wheel debounce ref for history push
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wheelInitialDomainRef = useRef<{ xDomain: [number, number]; yDomain: [number, number] } | null>(null);

  // Retrieve active channels
  const activeChannels = useMemo(() => {
    return allChannels.filter((ch) => view.channelIds.includes(ch.id));
  }, [allChannels, view.channelIds]);

  // Process data per analysis mode (FFT, smoothing, derivative, normalization)
  const processedSeries = useMemo(() => {
    return activeChannels.map((ch) => {
      let x = ch.xValues;
      let y = ch.yValues;
      let xLabel = ch.xLabel;
      let yLabel = ch.yLabel;

      if (view.analysisMode === 'fft') {
        const samplingRate = ch.stats.samplingRateApprox || 1000;
        const fft = computeFFT(ch.yValues, samplingRate);
        x = fft.frequencies;
        y = fft.magnitudes;
        xLabel = 'Frequency (Hz)';
        yLabel = `Magnitude (${ch.unit})`;
      } else if (view.analysisMode === 'smooth') {
        y = computeMovingAverage(ch.yValues, view.smoothingWindow || 11);
        yLabel = `${ch.name} (Smoothed N=${view.smoothingWindow || 11})`;
      } else if (view.analysisMode === 'derivative') {
        y = computeDerivative(ch.xValues, ch.yValues);
        yLabel = `d(${ch.name})/dt`;
      } else if (view.analysisMode === 'normalized') {
        y = normalizeValues(ch.yValues);
        yLabel = `${ch.name} (Norm [0,1])`;
      }

      return {
        channel: ch,
        x,
        y,
        xLabel,
        yLabel,
        hidden: view.hiddenChannelIds.includes(ch.id),
      };
    });
  }, [activeChannels, view.analysisMode, view.smoothingWindow, view.hiddenChannelIds]);

  // Calculate full bounds
  const fullBounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const visible = processedSeries.filter((s) => !s.hidden);
    if (visible.length === 0) {
      return { minX: 0, maxX: 10, minY: -1, maxY: 1 };
    }

    visible.forEach((s) => {
      if (s.x.length > 0) {
        minX = Math.min(minX, s.x[0]);
        maxX = Math.max(maxX, s.x[s.x.length - 1]);
      }
      for (let i = 0; i < s.y.length; i++) {
        const v = s.y[i];
        if (v < minY) minY = v;
        if (v > maxY) maxY = v;
      }
    });

    if (!isFinite(minX)) minX = 0;
    if (!isFinite(maxX)) maxX = 1;
    if (!isFinite(minY)) minY = 0;
    if (!isFinite(maxY)) maxY = 1;

    // Small padding
    const yPadding = (maxY - minY) * 0.05 || 0.1;
    return {
      minX,
      maxX,
      minY: minY - yPadding,
      maxY: maxY + yPadding,
    };
  }, [processedSeries]);

  // Active viewing domains
  const xDomain = view.xDomain || [fullBounds.minX, fullBounds.maxX];
  const yDomain = view.yDomain || [fullBounds.minY, fullBounds.maxY];

  // Helper coordinate conversions with adaptive compact margins
  const getPlotArea = (width: number, height: number) => {
    const isCompactW = width < 420;
    const isTinyW = width < 320;
    const isCompactH = height < 260;

    const left = isTinyW ? 38 : isCompactW ? 48 : 62;
    const right = width - (isTinyW ? 8 : isCompactW ? 12 : 20);
    const top = isCompactH ? 16 : 22;
    const bottom = height - (isCompactH ? 24 : 36);

    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(10, right - left),
      height: Math.max(10, bottom - top),
    };
  };

  const dataToScreen = useCallback(
    (xVal: number, yVal: number, plotArea: ReturnType<typeof getPlotArea>) => {
      const [xMin, xMax] = xDomain;
      const [yMin, yMax] = yDomain;
      const xRange = xMax - xMin || 1;
      const yRange = yMax - yMin || 1;

      const px = plotArea.left + ((xVal - xMin) / xRange) * plotArea.width;
      const py = plotArea.bottom - ((yVal - yMin) / yRange) * plotArea.height;
      return { px, py };
    },
    [xDomain, yDomain]
  );

  const screenToData = useCallback(
    (px: number, py: number, plotArea: ReturnType<typeof getPlotArea>) => {
      const [xMin, xMax] = xDomain;
      const [yMin, yMax] = yDomain;
      const xRange = xMax - xMin || 1;
      const yRange = yMax - yMin || 1;

      const xVal = xMin + ((px - plotArea.left) / plotArea.width) * xRange;
      const yVal = yMin + ((plotArea.bottom - py) / plotArea.height) * yRange;
      return { xVal, yVal };
    },
    [xDomain, yDomain]
  );

  // Render Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const plotArea = getPlotArea(width, height);

    // Styling themes following Windows 11 Fluent Design System
    const bgColor = isDark ? '#202020' : '#FFFFFF';
    const gridColor = isDark ? '#2F2F2F' : '#E5E5E5';
    const axisColor = isDark ? '#A0A0A0' : '#111111';
    const textColor = isDark ? '#D4D4D4' : '#111111';
    const borderColor = isDark ? '#3A3A3A' : '#CCCCCC';

    // Clear background (#202020 in Dark Mode, #FFFFFF in Light Mode)
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Draw Plot Area Frame
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(plotArea.left, plotArea.top, plotArea.width, plotArea.height);

    const isCompactW = width < 420;
    const isTinyW = width < 320;
    const isCompactH = height < 260;
    const xTicksCount = isTinyW ? 3 : isCompactW ? 4 : 7;
    const yTicksCount = isCompactH ? 3 : 5;
    const axisFontSize = isTinyW ? '10px' : isCompactW ? '11px' : '12px';

    // Draw Grid Lines (if enabled)
    if (view.showGrid) {
      ctx.beginPath();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;

      // X Grid lines
      for (let i = 0; i <= xTicksCount; i++) {
        const px = plotArea.left + (i / xTicksCount) * plotArea.width;
        ctx.moveTo(px, plotArea.top);
        ctx.lineTo(px, plotArea.bottom);
      }

      // Y Grid lines
      for (let j = 0; j <= yTicksCount; j++) {
        const py = plotArea.bottom - (j / yTicksCount) * plotArea.height;
        ctx.moveTo(plotArea.left, py);
        ctx.lineTo(plotArea.right, py);
      }
      ctx.stroke();
    }

    // Always Draw Axis Numbers & Tick Marks for High Legibility
    ctx.fillStyle = textColor;
    ctx.font = `600 ${axisFontSize} "Segoe UI Variable Text", "Segoe UI Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    // X Axis ticks & numbers
    for (let i = 0; i <= xTicksCount; i++) {
      const px = plotArea.left + (i / xTicksCount) * plotArea.width;
      const val = xDomain[0] + (i / xTicksCount) * (xDomain[1] - xDomain[0]);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(formatScientificOrFixed(val, 2), px, plotArea.bottom + (isCompactH ? 4 : 6));
    }

    // Y Axis ticks & numbers
    for (let j = 0; j <= yTicksCount; j++) {
      const py = plotArea.bottom - (j / yTicksCount) * plotArea.height;
      const val = yDomain[0] + (j / yTicksCount) * (yDomain[1] - yDomain[0]);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatScientificOrFixed(val, 2), plotArea.left - (isCompactW ? 4 : 8), py);
    }

    // Clip to plot area for drawing data curves
    ctx.save();
    ctx.beginPath();
    ctx.rect(plotArea.left, plotArea.top, plotArea.width, plotArea.height);
    ctx.clip();

    // Render Data Series
    processedSeries.forEach((series) => {
      if (series.hidden || series.x.length === 0) return;

      // Downsample for viewport if data is dense
      const targetPoints = Math.min(series.x.length, Math.floor(plotArea.width * 2));
      const { x: downX, y: downY } =
        series.x.length > 2500
          ? lttbDownsample(series.x, series.y, targetPoints)
          : { x: series.x, y: series.y };

      // Map color to glowing, light-injected cyan (#60CDFF) in dark mode if needed
      let strokeColor = series.channel.color;
      if (isDark) {
        const lower = strokeColor.toLowerCase();
        if (
          lower === '#00b4d8' ||
          lower === '#06b6d4' ||
          lower === '#0284c7' ||
          lower === '#0891b2' ||
          lower === '#0ea5e9'
        ) {
          strokeColor = '#60CDFF';
        }
      }

      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isDark ? 2.5 : 2.25; // 2px-2.5px stroke width
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      let started = false;
      for (let i = 0; i < downX.length; i++) {
        const xv = downX[i];
        const yv = downY[i];
        const { px, py } = dataToScreen(xv, yv, plotArea);

        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      // Subtle luminous glow in dark mode so it stands out distinctly
      if (isDark) {
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4.5;
        ctx.globalAlpha = 0.22;
        ctx.stroke();
        ctx.restore();
      }
    });

    // Draw Dual Cursors if active
    if (view.showDualCursor) {
      if (view.cursorA !== null) {
        const { px } = dataToScreen(view.cursorA, 0, plotArea);
        if (px >= plotArea.left && px <= plotArea.right) {
          ctx.beginPath();
          ctx.strokeStyle = '#38bdf8';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.moveTo(px, plotArea.top);
          ctx.lineTo(px, plotArea.bottom);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#38bdf8';
          ctx.font = '10px ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(' [A]', px + 4, plotArea.top + 15);
        }
      }
      if (view.cursorB !== null) {
        const { px } = dataToScreen(view.cursorB, 0, plotArea);
        if (px >= plotArea.left && px <= plotArea.right) {
          ctx.beginPath();
          ctx.strokeStyle = '#f43f5e';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
          ctx.moveTo(px, plotArea.top);
          ctx.lineTo(px, plotArea.bottom);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#f43f5e';
          ctx.font = '10px ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(' [B]', px + 4, plotArea.top + 30);
        }
      }
    }

    // Draw Crosshair Cursor Inspector
    if (view.mode === 'cursor' && currentMouse && !isMouseDown) {
      const mx = Math.max(plotArea.left, Math.min(plotArea.right, currentMouse.x));
      const my = Math.max(plotArea.top, Math.min(plotArea.bottom, currentMouse.y));

      ctx.beginPath();
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.35)';
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1;
      // Vertical
      ctx.moveTo(mx, plotArea.top);
      ctx.lineTo(mx, plotArea.bottom);
      // Horizontal
      ctx.moveTo(plotArea.left, my);
      ctx.lineTo(plotArea.right, my);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Box Selection Rect (Zoom Box)
    if (isMouseDown && dragStart && currentMouse && view.mode === 'select' && !isMiddlePanning) {
      const boxLeft = Math.max(plotArea.left, Math.min(dragStart.x, currentMouse.x));
      const boxTop = Math.max(plotArea.top, Math.min(dragStart.y, currentMouse.y));
      const boxWidth = Math.abs(currentMouse.x - dragStart.x);
      const boxHeight = Math.abs(currentMouse.y - dragStart.y);

      // Clamped width and height
      const clWidth = Math.min(boxWidth, plotArea.right - boxLeft);
      const clHeight = Math.min(boxHeight, plotArea.bottom - boxTop);

      ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(14, 165, 233, 0.15)';
      ctx.fillRect(boxLeft, boxTop, clWidth, clHeight);

      ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(boxLeft, boxTop, clWidth, clHeight);
      ctx.setLineDash([]);
    }

    ctx.restore(); // restore clip

    // Axis Labels: high-contrast and clear font
    const firstSeries = processedSeries[0];
    const xUnitLabel = firstSeries ? firstSeries.xLabel : 'Time / Index';
    const yUnitLabel = firstSeries && firstSeries.channel.unit ? `[${firstSeries.channel.unit}]` : '';

    if (!isTinyW) {
      ctx.fillStyle = isDark ? '#A0A0A0' : '#111111';
      ctx.font = `600 ${isCompactW ? '10px' : '11px'} "Segoe UI Variable Text", "Segoe UI Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      
      // Bottom X label (only if height has room)
      if (height > 180) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(xUnitLabel, plotArea.left + plotArea.width / 2, height - 2);
      }

      // Top Y unit badge/label if available
      if (yUnitLabel && plotArea.top >= 14) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(yUnitLabel, plotArea.left, 2);
      }
    }

    ctx.restore();
  }, [
    isDark,
    view.showGrid,
    view.showDualCursor,
    view.cursorA,
    view.cursorB,
    view.mode,
    xDomain,
    yDomain,
    processedSeries,
    isMouseDown,
    dragStart,
    currentMouse,
    isMiddlePanning,
    dataToScreen,
  ]);

  // Handle Resize and Container Dimensions Sync via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          const w = Math.round(entry.contentRect.width);
          const h = Math.round(entry.contentRect.height);
          setContainerWidth(w);
          setContainerHeight(h);
        }
      }
      renderCanvas();
    });

    observer.observe(el);
    renderCanvas();

    const handleWindowResize = () => {
      renderCanvas();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [renderCanvas]);

  // Setup Wheel Zoom Event Listener (Must be non-passive to prevent page scroll)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const plotArea = getPlotArea(rect.width, rect.height);

      const mousePx = e.clientX - rect.left;
      const mousePy = e.clientY - rect.top;

      if (
        mousePx < plotArea.left ||
        mousePx > plotArea.right ||
        mousePy < plotArea.top ||
        mousePy > plotArea.bottom
      ) {
        return;
      }

      // Record starting domain for debounced history push
      if (!wheelInitialDomainRef.current) {
        wheelInitialDomainRef.current = {
          xDomain: [...xDomain] as [number, number],
          yDomain: [...yDomain] as [number, number],
        };
      }

      const { xVal, yVal } = screenToData(mousePx, mousePy, plotArea);
      const zoomFactor = e.deltaY < 0 ? 0.85 : 1.18; // In / Out

      const newXSpan = (xDomain[1] - xDomain[0]) * zoomFactor;
      const newYSpan = (yDomain[1] - yDomain[0]) * zoomFactor;

      const xRatio = (xVal - xDomain[0]) / (xDomain[1] - xDomain[0] || 1);
      const yRatio = (yVal - yDomain[0]) / (yDomain[1] - yDomain[0] || 1);

      const nextXMin = xVal - xRatio * newXSpan;
      const nextXMax = nextXMin + newXSpan;
      const nextYMin = yVal - yRatio * newYSpan;
      const nextYMax = nextYMin + newYSpan;

      onUpdateView({
        xDomain: [nextXMin, nextXMax],
        yDomain: [nextYMin, nextYMax],
      });

      // Debounce push to history stack so scroll doesn't flood history
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
      wheelTimeoutRef.current = setTimeout(() => {
        if (wheelInitialDomainRef.current) {
          const newStack = [
            ...(view.historyStack || []),
            wheelInitialDomainRef.current,
          ].slice(-25); // keep max 25 levels
          onUpdateView({ historyStack: newStack });
          wheelInitialDomainRef.current = null;
        }
      }, 350);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
  }, [xDomain, yDomain, screenToData, onUpdateView, view.historyStack]);

  // Mouse Down handler
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const plotArea = getPlotArea(rect.width, rect.height);

    // Left click = 0, Middle click = 1, Right click = 2
    if (e.button === 1 || e.shiftKey || view.mode === 'pan') {
      // Middle click or Pan mode
      setIsMiddlePanning(true);
      setPanOrigin({
        mouseX: px,
        mouseY: py,
        xDomain: [...xDomain] as [number, number],
        yDomain: [...yDomain] as [number, number],
      });
      setIsMouseDown(true);
      return;
    }

    if (e.button === 0) {
      if (view.mode === 'cursor' && view.showDualCursor) {
        // Set Cursor A or B
        const { xVal } = screenToData(px, py, plotArea);
        if (view.cursorA === null || (view.cursorB !== null && Math.abs(xVal - (view.cursorA || 0)) < Math.abs(xVal - (view.cursorB || 0)))) {
          onUpdateView({ cursorA: xVal });
        } else {
          onUpdateView({ cursorB: xVal });
        }
        return;
      }

      // Box Selection Zoom mode
      setIsMouseDown(true);
      setDragStart({ x: px, y: py });
      setCurrentMouse({ x: px, y: py });
    }
  };

  // Mouse Move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const plotArea = getPlotArea(rect.width, rect.height);

    setCurrentMouse({ x: px, y: py });

    // Handle Active Panning
    if (isMiddlePanning && panOrigin) {
      const dxPixels = px - panOrigin.mouseX;
      const dyPixels = py - panOrigin.mouseY;

      const xSpan = panOrigin.xDomain[1] - panOrigin.xDomain[0];
      const ySpan = panOrigin.yDomain[1] - panOrigin.yDomain[0];

      const dxData = -(dxPixels / plotArea.width) * xSpan;
      const dyData = (dyPixels / plotArea.height) * ySpan;

      onUpdateView({
        xDomain: [panOrigin.xDomain[0] + dxData, panOrigin.xDomain[1] + dxData],
        yDomain: [panOrigin.yDomain[0] + dyData, panOrigin.yDomain[1] + dyData],
      });
      return;
    }

    // Inspector Cursor values calculation
    if (px >= plotArea.left && px <= plotArea.right && py >= plotArea.top && py <= plotArea.bottom) {
      const { xVal } = screenToData(px, py, plotArea);
      const vals: Record<string, number> = {};

      processedSeries.forEach((s) => {
        if (s.hidden || s.x.length === 0) return;
        // Find nearest sample index
        let low = 0;
        let high = s.x.length - 1;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (s.x[mid] < xVal) low = mid + 1;
          else high = mid - 1;
        }
        const idx = Math.max(0, Math.min(s.x.length - 1, low));
        vals[s.channel.id] = s.y[idx];
      });

      setCursorData({ xVal, channelValues: vals });
    } else {
      setCursorData(null);
    }
  };

  // Mouse Up handler (Applies Zoom or Ends Pan)
  const handleMouseUp = () => {
    if (isMiddlePanning) {
      // If we panned, push the starting state to history stack
      if (panOrigin) {
        const newStack = [
          ...(view.historyStack || []),
          { xDomain: panOrigin.xDomain, yDomain: panOrigin.yDomain },
        ].slice(-25);
        onUpdateView({ historyStack: newStack });
      }
      setIsMiddlePanning(false);
      setPanOrigin(null);
      setIsMouseDown(false);
      return;
    }

    if (isMouseDown && dragStart && currentMouse && view.mode === 'select') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const plotArea = getPlotArea(rect.width, rect.height);

      const dx = Math.abs(currentMouse.x - dragStart.x);
      const dy = Math.abs(currentMouse.y - dragStart.y);

      // Only zoom if dragged more than 8 pixels to prevent accidental micro-clicks
      if (dx > 8 && dy > 8) {
        const startData = screenToData(
          Math.min(dragStart.x, currentMouse.x),
          Math.max(dragStart.y, currentMouse.y),
          plotArea
        );
        const endData = screenToData(
          Math.max(dragStart.x, currentMouse.x),
          Math.min(dragStart.y, currentMouse.y),
          plotArea
        );

        const newXMin = Math.min(startData.xVal, endData.xVal);
        const newXMax = Math.max(startData.xVal, endData.xVal);
        const newYMin = Math.min(startData.yVal, endData.yVal);
        const newYMax = Math.max(startData.yVal, endData.yVal);

        // Push current view to history stack for right-click step-back undo
        const newStack = [
          ...(view.historyStack || []),
          { xDomain: [...xDomain] as [number, number], yDomain: [...yDomain] as [number, number] },
        ].slice(-25);

        onUpdateView({
          xDomain: [newXMin, newXMax],
          yDomain: [newYMin, newYMax],
          historyStack: newStack,
        });
      }
    }

    setIsMouseDown(false);
    setDragStart(null);
  };

  // Right-Click Context Menu: Step-by-Step Zoom Out Reversion
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Suppress browser menu

    if (view.historyStack && view.historyStack.length > 0) {
      const stack = [...view.historyStack];
      const previousState = stack.pop()!;
      onUpdateView({
        xDomain: previousState.xDomain,
        yDomain: previousState.yDomain,
        historyStack: stack,
      });

      setUndoNotice(
        stack.length > 0
          ? `Zoom Reverted (${stack.length} ${stack.length === 1 ? 'step' : 'steps'} left)`
          : 'Reverted to Original View'
      );
      setTimeout(() => setUndoNotice(null), 1800);
    } else {
      // If stack is empty, reset to 100% full extent
      handleResetView();
      setUndoNotice('Already at Original Full Extent');
      setTimeout(() => setUndoNotice(null), 1500);
    }
  };

  // Reset View to Initial State
  const handleResetView = () => {
    onUpdateView({
      xDomain: [fullBounds.minX, fullBounds.maxX],
      yDomain: [fullBounds.minY, fullBounds.maxY],
      historyStack: [],
    });
  };

  // Step-back Zoom Undo Button
  const handleStepBackZoom = () => {
    if (view.historyStack && view.historyStack.length > 0) {
      const stack = [...view.historyStack];
      const previousState = stack.pop()!;
      onUpdateView({
        xDomain: previousState.xDomain,
        yDomain: previousState.yDomain,
        historyStack: stack,
      });
      setUndoNotice(`Zoom Reverted (${stack.length} steps remaining)`);
      setTimeout(() => setUndoNotice(null), 1800);
    } else {
      handleResetView();
    }
  };

  // Snapshot PNG Export
  const handleExportSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create high-res offscreen rendering with watermarked title and date
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height + 40;
    const exCtx = exportCanvas.getContext('2d');
    if (!exCtx) return;

    exCtx.fillStyle = isDark ? '#090a0f' : '#ffffff';
    exCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Title banner
    exCtx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
    exCtx.font = 'bold 16px sans-serif';
    exCtx.fillText(view.title, 20, 26);

    exCtx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    exCtx.font = '12px ui-monospace, monospace';
    exCtx.textAlign = 'right';
    exCtx.fillText(new Date().toLocaleString(), exportCanvas.width - 20, 26);

    // Draw main plot
    exCtx.drawImage(canvas, 0, 35);

    const link = document.createElement('a');
    link.download = `${view.title.replace(/\s+/g, '_')}_snapshot_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  // Toggle channel visibility in dynamic legend
  const toggleChannelVisibility = (channelId: string) => {
    const hidden = new Set(view.hiddenChannelIds || []);
    if (hidden.has(channelId)) {
      hidden.delete(channelId);
    } else {
      // Don't allow hiding all channels
      if (hidden.size < activeChannels.length - 1) {
        hidden.add(channelId);
      }
    }
    onUpdateView({ hiddenChannelIds: Array.from(hidden) });
  };

  // Isolate / Solo a channel
  const isolateChannel = (channelId: string) => {
    const allOtherIds = activeChannels.map((c) => c.id).filter((id) => id !== channelId);
    // If already isolated, restore all
    if (
      view.hiddenChannelIds.length === allOtherIds.length &&
      !view.hiddenChannelIds.includes(channelId)
    ) {
      onUpdateView({ hiddenChannelIds: [] });
    } else {
      onUpdateView({ hiddenChannelIds: allOtherIds });
    }
  };

  // Toggle adding/removing channels to this tile (Superposition)
  const toggleSuperposedChannel = (channelId: string) => {
    let nextChannels = [...view.channelIds];
    if (nextChannels.includes(channelId)) {
      if (nextChannels.length > 1) {
        nextChannels = nextChannels.filter((id) => id !== channelId);
      }
    } else {
      nextChannels.push(channelId);
    }
    onUpdateView({ channelIds: nextChannels });
  };

  // Dual cursor delta calculations
  const deltaX =
    view.cursorA !== null && view.cursorB !== null
      ? Math.abs(view.cursorB - view.cursorA)
      : null;
  const deltaFreq = deltaX && deltaX > 0 ? 1 / deltaX : null;
  const isCompactHeader = true;

  return (
    <div
      ref={containerRef}
      id={`graph-container-${view.id}`}
      className={`relative flex flex-col h-full rounded-[4px] border transition-all duration-150 overflow-hidden ${
        isDark
          ? 'bg-[#2C2C2C] border-[#3A3A3A] text-[#FFFFFF]'
          : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#111111]'
      } shadow-xs`}
    >
      {/* Tile Header & Toolbar */}
      <div
        id={`graph-header-${view.id}`}
        className={`flex flex-col items-stretch px-2.5 py-1.5 border-b select-none text-[12px] sm:text-[13px] min-h-[36px] overflow-hidden gap-1.5 ${
          isDark ? 'border-[#3A3A3A] bg-[#242424]' : 'border-[#CCCCCC] bg-[#EEEEEE]'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 w-full">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isDark ? 'bg-[#60CDFF] border border-white/90' : 'bg-[#0067B8] border border-black/80'
            }`}
          ></span>
          <span
            title={view.title}
            className={`text-[13px] sm:text-[14px] font-semibold tracking-tight truncate leading-tight ${
              isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
            }`}
          >
            {view.title}
          </span>
          {activeChannels.length > 1 && (
            <span
              title={`${activeChannels.length} channels superposed`}
              className={`shrink-0 px-1.5 py-0.5 rounded-[4px] text-[10px] sm:text-[11px] font-medium border ${
                isDark
                  ? 'bg-[#202020] text-[#A0A0A0] border-[#3A3A3A]'
                  : 'bg-[#E5E5E5] text-[#222222] border-[#CCCCCC]'
              }`}
            >
              {containerWidth < 480 ? `+${activeChannels.length - 1}` : `Superposed (${activeChannels.length})`}
            </span>
          )}
          {view.analysisMode !== 'raw' && containerWidth >= 620 && (
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded-[4px] text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider border ${
                isDark
                  ? 'bg-[#202020] text-[#60CDFF] border-[#3A3A3A]'
                  : 'bg-[#E5E5E5] text-[#0067B8] border-[#CCCCCC]'
              }`}
            >
              {view.analysisMode}
            </span>
          )}
        </div>

        {/* Action Controls - Always grouped in a second row for multi-graph layouts */}
        <div className="flex flex-wrap items-center gap-1 w-full justify-start pt-1 border-t border-inherit">
          {/* Superposition Channel Selector */}
          <div className="relative">
            <button
              id={`superposition-btn-${view.id}`}
              onClick={() => setShowChannelSelect(!showChannelSelect)}
              title="Add or remove channels (Superposition)"
              className={`p-1 sm:px-2 sm:py-1 rounded-[4px] flex items-center gap-1 text-[11px] sm:text-[12px] font-medium transition-colors border ${
                showChannelSelect || activeChannels.length > 1
                  ? isDark
                    ? 'bg-[#3A3A3A] border-[#4A4A4A] text-[#FFFFFF]'
                    : 'bg-[#E5E5E5] border-[#CCCCCC] text-[#111111]'
                  : isDark
                  ? 'border-transparent text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#3A3A3A]'
                  : 'border-transparent text-[#444444] hover:text-[#000000] hover:bg-[#E5E5E5]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {containerWidth >= 480 && <span>Overlay</span>}
            </button>

            {/* Channel Overlay Dropdown */}
            {showChannelSelect && (
              <div
                className={`absolute right-0 top-full mt-1 w-64 p-2 rounded-[4px] shadow-xl border z-30 ${
                  isDark
                    ? 'bg-[#202020] border-[#3A3A3A] text-[#FFFFFF]'
                    : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#111111]'
                }`}
              >
                <div
                  className={`text-[12px] font-semibold mb-2 pb-1 border-b flex justify-between items-center ${
                    isDark ? 'border-[#3A3A3A] text-[#FFFFFF]' : 'border-[#E5E5E5] text-[#111111]'
                  }`}
                >
                  <span>Superposition Channels</span>
                  <span className={`text-[11px] ${isDark ? 'text-[#A0A0A0]' : 'text-[#5F5F5F]'}`}>
                    {activeChannels.length} active
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {allChannels.map((ch) => {
                    const isSelected = view.channelIds.includes(ch.id);
                    return (
                      <label
                        key={ch.id}
                        className={`flex items-center gap-2 p-1.5 rounded-[4px] text-[13px] cursor-pointer transition-colors ${
                          isDark ? 'hover:bg-[#2C2C2C]' : 'hover:bg-[#F3F3F3]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSuperposedChannel(ch.id)}
                          className={`rounded-[2px] ${
                            isDark ? 'accent-[#60CDFF]' : 'accent-[#0067B8]'
                          }`}
                        />
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isDark ? 'border border-white/90' : 'border border-black/80'
                          }`}
                          style={{ backgroundColor: ch.color }}
                        ></span>
                        <span
                          className={`truncate flex-1 font-semibold text-[13px] ${
                            isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
                          }`}
                        >
                          {ch.name}
                        </span>
                        <span className={`text-[11px] font-medium ${isDark ? 'text-[#A0A0A0]' : 'text-[#444444]'}`}>
                          {ch.unit}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Analysis Mode Selector: Compact dropdown on narrow tile widths, Segmented on wider widths */}
          {containerWidth < 620 ? (
            <select
              value={view.analysisMode}
              onChange={(e) => onUpdateView({ analysisMode: e.target.value as AnalysisMode })}
              title="Math Analysis Mode (Raw, FFT, Smoothing, Derivative)"
              className={`px-1.5 py-0.5 rounded-[4px] text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider border outline-hidden cursor-pointer transition-colors ${
                isDark
                  ? 'bg-[#202020] border-[#3A3A3A] text-[#60CDFF] focus:border-[#60CDFF]'
                  : 'bg-[#FFFFFF] border-[#CCCCCC] text-[#0067B8] focus:border-[#0067B8]'
              }`}
            >
              <option value="raw">Raw</option>
              <option value="fft">FFT</option>
              <option value="smooth">Smooth</option>
              <option value="derivative">Deriv</option>
            </select>
          ) : (
            <div
              className={`flex items-center p-0.5 rounded-[4px] border text-[11px] ${
                isDark ? 'bg-[#202020] border-[#3A3A3A]' : 'bg-[#E5E5E5] border-[#CCCCCC]'
              }`}
            >
              {(['raw', 'fft', 'smooth', 'derivative'] as AnalysisMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onUpdateView({ analysisMode: mode })}
                  className={`px-2 py-0.5 rounded-[3px] text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    view.analysisMode === mode
                      ? isDark
                        ? 'bg-[#60CDFF] text-[#111111] shadow-xs'
                        : 'bg-[#0067B8] text-white shadow-xs'
                      : isDark
                      ? 'text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#2C2C2C]'
                      : 'text-[#444444] hover:text-[#000000] hover:bg-[#DCDCDC]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}

          {/* Tool Modes: Select (Box Zoom) / Pan (Hand) / Cursor */}
          <div
            className={`flex items-center rounded-[4px] border p-0.5 gap-0.5 ${
              isDark ? 'border-[#3A3A3A] bg-[#202020]' : 'border-[#CCCCCC] bg-[#F5F5F5]'
            }`}
          >
            <button
              id={`tool-select-${view.id}`}
              onClick={() => onUpdateView({ mode: 'select' })}
              title="Box Zoom Marquee: Drag to zoom into area"
              className={`p-1 rounded-[3px] transition-colors ${
                view.mode === 'select'
                  ? isDark
                    ? 'bg-[#60CDFF] text-[#111111]'
                    : 'bg-[#0067B8] text-white'
                  : isDark
                  ? 'text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#3A3A3A]'
                  : 'text-[#444444] hover:text-[#000000] hover:bg-[#E5E5E5]'
              }`}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              id={`tool-pan-${view.id}`}
              onClick={() => onUpdateView({ mode: 'pan' })}
              title="Move / Pan Tool: Click and hold to move graph anywhere"
              className={`p-1 rounded-[3px] transition-colors ${
                view.mode === 'pan'
                  ? isDark
                    ? 'bg-[#60CDFF] text-[#111111]'
                    : 'bg-[#0067B8] text-white'
                  : isDark
                  ? 'text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#3A3A3A]'
                  : 'text-[#444444] hover:text-[#000000] hover:bg-[#E5E5E5]'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
            </button>
            <button
              id={`tool-cursor-${view.id}`}
              onClick={() => onUpdateView({ mode: 'cursor' })}
              title="Crosshair Inspector: Inspect values at point"
              className={`p-1 rounded-[3px] transition-colors ${
                view.mode === 'cursor'
                  ? isDark
                    ? 'bg-[#60CDFF] text-[#111111]'
                    : 'bg-[#0067B8] text-white'
                  : isDark
                  ? 'text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#3A3A3A]'
                  : 'text-[#444444] hover:text-[#000000] hover:bg-[#E5E5E5]'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dual Cursor Toggle */}
          <button
            id={`tool-dual-cursor-${view.id}`}
            onClick={() => onUpdateView({ showDualCursor: !view.showDualCursor })}
            title="Dual Delta Cursors [A / B]"
            className={`p-1 sm:p-1.5 rounded-[4px] transition-colors ${
              view.showDualCursor
                ? isDark
                  ? 'bg-[#60CDFF] text-[#111111]'
                  : 'bg-[#0067B8] text-white'
                : isDark
                ? 'text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#3A3A3A]'
                : 'text-[#444444] hover:text-[#000000] hover:bg-[#E5E5E5]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
          </button>

          {/* Step-Back Zoom (Undo zoom level) */}
          <button
            id={`step-back-zoom-${view.id}`}
            onClick={handleStepBackZoom}
            disabled={!view.historyStack || view.historyStack.length === 0}
            title="Step Back Zoom: Revert zoom step (or Right-Click canvas)"
            className={`p-1 sm:p-1.5 rounded-[4px] transition-colors relative ${
              view.historyStack && view.historyStack.length > 0
                ? isDark
                  ? 'text-amber-400 hover:bg-[#3A3A3A] font-bold'
                  : 'text-amber-600 hover:bg-[#E5E5E5] font-bold'
                : 'opacity-30 cursor-not-allowed text-[#A0A0A0]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {view.historyStack && view.historyStack.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 text-[9px] bg-amber-500 text-black font-bold rounded-full flex items-center justify-center">
                {view.historyStack.length}
              </span>
            )}
          </button>

          {/* Reset View Button */}
          <button
            id={`reset-view-${view.id}`}
            onClick={handleResetView}
            title="Reset View: Return to 100% full extent"
            className={`px-1.5 py-1 sm:px-2 rounded-[4px] text-[11px] sm:text-[12px] font-medium transition-colors flex items-center gap-1 border ${
              isDark
                ? 'bg-[#202020] border-[#3A3A3A] hover:bg-[#3A3A3A] text-[#FFFFFF]'
                : 'bg-[#FFFFFF] border-[#CCCCCC] hover:bg-[#F3F3F3] text-[#111111]'
            }`}
          >
            {containerWidth >= 480 ? (
              <span>Reset</span>
            ) : (
              <RotateCcw className="w-3 h-3" />
            )}
          </button>

          {/* Snapshot Button (visible when containerWidth >= 400 or maximized) */}
          {(containerWidth >= 400 || isMaximized) && (
            <button
              id={`snapshot-btn-${view.id}`}
              onClick={handleExportSnapshot}
              title="Export snapshot image (PNG)"
              className={`p-1 sm:p-1.5 rounded-[4px] transition-colors ${
                isDark
                  ? 'text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#3A3A3A]'
                  : 'text-[#444444] hover:text-[#000000] hover:bg-[#E5E5E5]'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Maximize Toggle */}
          <button
            id={`maximize-btn-${view.id}`}
            onClick={onToggleMaximize}
            title={isMaximized ? 'Restore View' : 'Maximize Graph to full screen'}
            className={`p-1 sm:p-1.5 rounded-[4px] transition-colors ${
              isDark
                ? 'text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#3A3A3A]'
                : 'text-[#444444] hover:text-[#000000] hover:bg-[#E5E5E5]'
            }`}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Canvas Canvas Visualization Area */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          id={`canvas-${view.id}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
          className={`w-full h-full block ${
            view.mode === 'pan' || isMiddlePanning
              ? 'cursor-grab active:cursor-grabbing'
              : view.mode === 'cursor'
              ? 'cursor-crosshair'
              : 'cursor-crosshair'
          }`}
        />

        {/* Floating Notification for Step-Back Zoom / Revert */}
        {undoNotice && (
          <div
            className={`absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-[4px] text-[12px] font-medium shadow-lg border backdrop-blur pointer-events-none animate-fade-in z-20 ${
              isDark
                ? 'bg-[#1C1C1C]/95 border-[#3A3A3A] text-amber-400'
                : 'bg-[#FFFFFF]/95 border-[#E5E5E5] text-amber-600'
            }`}
          >
            {undoNotice}
          </div>
        )}

        {/* Dual Cursor Delta Measurement Readout Banner */}
        {view.showDualCursor && view.cursorA !== null && view.cursorB !== null && (
          <div
            className={`absolute top-2 right-2 px-3 py-1.5 rounded-[4px] text-[12px] font-mono shadow-md border backdrop-blur z-10 flex items-center gap-3 ${
              isDark
                ? 'bg-[#202020]/95 border-[#3A3A3A] text-[#FFFFFF]'
                : 'bg-[#FFFFFF]/95 border-[#E5E5E5] text-[#111111]'
            }`}
          >
            <span className={isDark ? 'text-[#60CDFF]' : 'text-[#0067B8]'}>
              A: {formatScientificOrFixed(view.cursorA, 3)}
            </span>
            <span className="text-rose-500 font-medium">
              B: {formatScientificOrFixed(view.cursorB, 3)}
            </span>
            <span className="font-semibold text-amber-500">
              ΔX: {formatScientificOrFixed(deltaX || 0, 3)}
            </span>
            {deltaFreq && (
              <span className="text-emerald-500">
                1/ΔX: {formatScientificOrFixed(deltaFreq, 2)} Hz
              </span>
            )}
          </div>
        )}

        {/* Guidance Hint when hovering (only shown when canvas has enough vertical and horizontal clearance) */}
        {containerHeight > 200 && containerWidth > 400 && (
          <div
            className={`absolute bottom-1 right-2 text-[11px] pointer-events-none select-none opacity-60 hover:opacity-100 transition-opacity ${
              isDark ? 'text-[#A0A0A0]' : 'text-[#5F5F5F]'
            }`}
          >
            {/* Drag: Zoom | Right-Click: Step Back | Wheel: Scroll Zoom | Middle: Pan */}
          </div>
        )}
      </div>

      {/* Dynamic Interactive Legend Bar with Visibility Toggles */}
      <div
        id={`graph-legend-${view.id}`}
        className={`flex items-center gap-1.5 px-2.5 py-1 border-t select-none text-[12px] overflow-x-auto shrink-0 ${
          isDark ? 'bg-[#242424] border-[#3A3A3A]' : 'bg-[#F3F3F3] border-[#E5E5E5]'
        }`}
      >
        <span className={`text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider shrink-0 ${isDark ? 'text-[#A0A0A0]' : 'text-[#5F5F5F]'}`}>
          Series:
        </span>

        {processedSeries.map((s) => {
          const liveVal = cursorData?.channelValues[s.channel.id];
          return (
            <div
              key={s.channel.id}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border shrink-0 transition-all ${
                s.hidden
                  ? 'opacity-40 border-transparent'
                  : isDark
                  ? 'bg-[#2C2C2C] border-[#3A3A3A] text-[#FFFFFF]'
                  : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#111111] shadow-2xs'
              }`}
            >
              {/* Visibility eye toggle */}
              <button
                onClick={() => toggleChannelVisibility(s.channel.id)}
                title={s.hidden ? 'Show Series' : 'Hide Series'}
                className="hover:scale-110 transition-transform shrink-0"
              >
                {s.hidden ? (
                  <EyeOff className={`w-3.5 h-3.5 ${isDark ? 'text-[#A0A0A0]' : 'text-[#555555]'}`} />
                ) : (
                  <span
                    className={`w-2.5 h-2.5 rounded-full inline-block shrink-0 ${
                      isDark ? 'border border-white/90' : 'border border-black/80'
                    }`}
                    style={{ backgroundColor: s.channel.color }}
                  ></span>
                )}
              </button>

              {/* Series Name & Double click to isolate */}
              <span
                onDoubleClick={() => isolateChannel(s.channel.id)}
                title="Double-click to isolate series"
                className={`cursor-pointer truncate max-w-[90px] sm:max-w-[130px] text-[12px] ${
                  s.hidden
                    ? isDark ? 'line-through text-[#666666]' : 'line-through text-[#888888]'
                    : isDark ? 'font-semibold text-[#FFFFFF]' : 'font-semibold text-[#111111]'
                }`}
              >
                {s.channel.name}
              </span>

              {/* Live value at crosshair cursor */}
              {!s.hidden && liveVal !== undefined && (
                <span className={`font-semibold ml-0.5 text-[11px] sm:text-[12px] shrink-0 ${isDark ? 'text-[#60CDFF]' : 'text-[#0067B8]'}`}>
                  {formatScientificOrFixed(liveVal, 2)}
                </span>
              )}
            </div>
          );
        })}

        {/* Cursor X coordinate readout */}
        {cursorData && (
          <div className={`ml-auto shrink-0 whitespace-nowrap text-[11px] sm:text-[12px] font-semibold pl-1.5 ${isDark ? 'text-[#60CDFF]' : 'text-[#0067B8]'}`}>
            X: {formatScientificOrFixed(cursorData.xVal, 3)}
          </div>
        )}
      </div>
    </div>
  );
};
