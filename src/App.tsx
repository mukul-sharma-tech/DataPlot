/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { InteractiveCanvasPlot } from './components/InteractiveCanvasPlot';
import { ReportModal } from './components/ReportModal';
import { HelpModal } from './components/HelpModal';
import {
  UploadedFile,
  DataChannel,
  GraphViewConfig,
  GridLayout,
} from './types';
import {
  parseCSVorTXT,
  parseTDMS,
  generateSampleDatasets,
} from './utils/fileParsers';

export default function App() {
  // Theme state (default dark mode for reduced eye strain during long analysis sessions)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('dataplot_theme');
    return saved !== null ? saved === 'dark' : true;
  });

  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Loaded Data
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [channels, setChannels] = useState<DataChannel[]>([]);

  // Screen Grid Layout: default 1 as requested ("initially default will be one, but then we can select 2 3 4 5")
  const [gridLayout, setGridLayout] = useState<GridLayout>(1);
  const [selectedVisibleViewIds, setSelectedVisibleViewIds] = useState<string[]>([]);

  // Graph Views
  const [views, setViews] = useState<GraphViewConfig[]>([]);
  const [maximizedViewId, setMaximizedViewId] = useState<string | null>(null);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Sync dark class and data-theme on documentElement
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('dataplot_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('dataplot_theme', 'light');
    }
  }, [isDark]);

  // Initial auto-load sample datasets so user sees functional graphs right away
  useEffect(() => {
    const samples = generateSampleDatasets();
    setFiles(samples.files);
    setChannels(samples.channels);

    // Initialize initial views for 1st channel (and superposed initial state)
    const initialViews: GraphViewConfig[] = [
      {
        id: 'view_1',
        title: 'Turbine Vibration Radial (DE)',
        channelIds: [samples.channels[0].id],
        hiddenChannelIds: [],
        xDomain: null,
        yDomain: null,
        historyStack: [],
        mode: 'select',
        analysisMode: 'raw',
        smoothingWindow: 11,
        yAxisScaleMode: 'auto',
        showDualCursor: false,
        cursorA: null,
        cursorB: null,
        showGrid: true,
      },
      {
        id: 'view_2',
        title: 'Acoustic Sound Pressure & Core Temp',
        channelIds: [samples.channels[2].id, samples.channels[4].id],
        hiddenChannelIds: [],
        xDomain: null,
        yDomain: null,
        historyStack: [],
        mode: 'select',
        analysisMode: 'raw',
        smoothingWindow: 11,
        yAxisScaleMode: 'auto',
        showDualCursor: false,
        cursorA: null,
        cursorB: null,
        showGrid: true,
      },
      {
        id: 'view_3',
        title: 'Combustion Cylinder 1 & 2 Pressure',
        channelIds: [samples.channels[5].id, samples.channels[6].id],
        hiddenChannelIds: [],
        xDomain: null,
        yDomain: null,
        historyStack: [],
        mode: 'select',
        analysisMode: 'raw',
        smoothingWindow: 11,
        yAxisScaleMode: 'auto',
        showDualCursor: false,
        cursorA: null,
        cursorB: null,
        showGrid: true,
      },
      {
        id: 'view_4',
        title: 'Harmonic Superposition Composite Wave',
        channelIds: [
          samples.channels[9].id,
          samples.channels[10].id,
          samples.channels[11].id,
          samples.channels[12].id,
        ],
        hiddenChannelIds: [],
        xDomain: null,
        yDomain: null,
        historyStack: [],
        mode: 'select',
        analysisMode: 'raw',
        smoothingWindow: 11,
        yAxisScaleMode: 'auto',
        showDualCursor: false,
        cursorA: null,
        cursorB: null,
        showGrid: true,
      },
      {
        id: 'view_5',
        title: 'Fuel Rail & Manifold Pressure',
        channelIds: [samples.channels[7].id, samples.channels[8].id],
        hiddenChannelIds: [],
        xDomain: null,
        yDomain: null,
        historyStack: [],
        mode: 'select',
        analysisMode: 'raw',
        smoothingWindow: 11,
        yAxisScaleMode: 'auto',
        showDualCursor: false,
        cursorA: null,
        cursorB: null,
        showGrid: true,
      },
      {
        id: 'view_6',
        title: 'Inlet Pressure Dynamics',
        channelIds: [samples.channels[3].id],
        hiddenChannelIds: [],
        xDomain: null,
        yDomain: null,
        historyStack: [],
        mode: 'select',
        analysisMode: 'raw',
        smoothingWindow: 11,
        yAxisScaleMode: 'auto',
        showDualCursor: false,
        cursorA: null,
        cursorB: null,
        showGrid: true,
      },
    ];

    setViews(initialViews);
    setSelectedVisibleViewIds(initialViews.slice(0, 1).map((view) => view.id));
  }, []);

  // Handle File Uploads (TDMS, CSV, TXT)
  const handleFileUpload = async (fileList: FileList) => {
    const newFiles: UploadedFile[] = [];
    const newChannels: DataChannel[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileId = `file_${Date.now()}_${i}`;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      try {
        if (ext === 'tdms') {
          const buffer = await file.arrayBuffer();
          const res = parseTDMS(buffer, file.name, fileId);
          newFiles.push(res.file);
          newChannels.push(...res.channels);
        } else {
          // CSV, TXT, or delimited text
          const text = await file.text();
          const res = parseCSVorTXT(text, file.name, fileId);
          newFiles.push(res.file);
          newChannels.push(...res.channels);
        }
      } catch (err: any) {
        console.error(`Error parsing file ${file.name}:`, err);
        alert(`Error parsing "${file.name}": ${err.message || 'Unknown error'}`);
      }
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...newFiles, ...prev]);
      setChannels((prev) => [...newChannels, ...prev]);

      // Automatically assign first new channel to active view 1
      if (newChannels.length > 0) {
        setViews((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          next[0] = {
            ...next[0],
            title: newChannels[0].name,
            channelIds: [newChannels[0].id],
            xDomain: null,
            yDomain: null,
            historyStack: [],
          };
          return next;
        });
      }
    }
  };

  // Re-load sample datasets
  const handleLoadSamples = () => {
    const samples = generateSampleDatasets();
    setFiles(samples.files);
    setChannels(samples.channels);
    setViews((prev) =>
      prev.map((v, idx) => ({
        ...v,
        channelIds: [samples.channels[idx % samples.channels.length].id],
        xDomain: null,
        yDomain: null,
        historyStack: [],
      }))
    );
  };

  // Delete file
  const handleDeleteFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setChannels((prev) => prev.filter((c) => c.fileId !== fileId));
    // Remove deleted channels from active views
    setViews((prev) =>
      prev.map((v) => {
        const remaining = v.channelIds.filter((cid) => !cid.startsWith(fileId));
        return {
          ...v,
          channelIds: remaining.length > 0 ? remaining : channels.length > 0 ? [channels[0].id] : [],
        };
      })
    );
  };

  // Add channel to view
  const handleAddChannelToView = (channelId: string) => {
    const ch = channels.find((c) => c.id === channelId);
    if (!ch) return;

    setViews((prev) => {
      const next = [...prev];
      // Target active view 1 or first available
      if (next.length > 0) {
        next[0] = {
          ...next[0],
          title: ch.name,
          channelIds: [channelId],
          xDomain: null,
          yDomain: null,
          historyStack: [],
        };
      }
      return next;
    });
  };

  // Superpose multiple channels into view 1
  const handleSuperposeChannels = (channelIds: string[]) => {
    setViews((prev) => {
      const next = [...prev];
      if (next.length > 0) {
        next[0] = {
          ...next[0],
          title: `Superposed (${channelIds.length} Series)`,
          channelIds: channelIds,
          hiddenChannelIds: [],
          xDomain: null,
          yDomain: null,
          historyStack: [],
        };
      }
      return next;
    });
  };

  // Update specific view configuration
  const handleUpdateView = (viewId: string, updated: Partial<GraphViewConfig>) => {
    setViews((prev) =>
      prev.map((v) => (v.id === viewId ? { ...v, ...updated } : v))
    );
  };

  // Reset all views to 100% full extent
  const handleResetAllViews = () => {
    setViews((prev) =>
      prev.map((v) => ({
        ...v,
        xDomain: null,
        yDomain: null,
        historyStack: [],
      }))
    );
  };

  useEffect(() => {
    if (views.length === 0) {
      setSelectedVisibleViewIds([]);
      return;
    }

    const allIds = views.map((view) => view.id);
    setSelectedVisibleViewIds((prev) => {
      const validPrev = prev.filter((id) => allIds.includes(id));
      const merged = [...validPrev];

      for (const id of allIds) {
        if (merged.length >= gridLayout) break;
        if (!merged.includes(id)) merged.push(id);
      }

      if (merged.length === 0) return allIds.slice(0, Math.min(gridLayout, allIds.length));
      return merged.slice(0, Math.min(gridLayout, allIds.length));
    });
  }, [views, gridLayout]);

  const visibleViewIds = maximizedViewId
    ? [maximizedViewId]
    : selectedVisibleViewIds.filter((id) => views.some((view) => view.id === id)).slice(0, gridLayout);

  const visibleViews = views.filter((view) => visibleViewIds.includes(view.id));

  // Responsive Grid CSS class computation
  const getGridClass = () => {
    if (maximizedViewId) return 'grid-cols-1 grid-rows-1 h-full';
    switch (gridLayout) {
      case 1:
        return 'grid-cols-1 grid-rows-1 h-full';
      case 2:
        return 'grid-cols-1 md:grid-cols-2 grid-rows-1 h-full';
      case 3:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 grid-rows-1 h-full';
      case 4:
        return 'grid-cols-1 md:grid-cols-2 md:grid-rows-2 h-full';
      case 5:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr h-full';
      case 6:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:grid-rows-3 lg:grid-rows-2 h-full';
      default:
        return 'grid-cols-1 h-full';
    }
  };

  return (
    <div
      id="dataplot-app-root"
      className={`flex flex-col h-screen w-screen overflow-hidden select-none ${
        isDark ? 'bg-[#1C1C1C] text-[#FFFFFF]' : 'bg-[#F3F3F3] text-[#111111]'
      }`}
      style={{
        fontFamily:
          '"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif',
      }}
    >
      {/* Top Navbar */}
      <Navbar
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onResetAllViews={handleResetAllViews}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        activeGraphCount={visibleViews.length}
        totalChannelCount={channels.length}
      />

      {/* Main Container: Collapsible Sidebar + Canvas Visualization Workspace */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden relative">
        {/* Collapsible Sidebar */}
        <Sidebar
          files={files}
          channels={channels}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onFileUpload={handleFileUpload}
          onLoadSamples={handleLoadSamples}
          onDeleteFile={handleDeleteFile}
          gridLayout={gridLayout}
          onChangeLayout={(layout) => {
            setMaximizedViewId(null);
            setGridLayout(layout);
            setSelectedVisibleViewIds((prev) => {
              const allIds = views.map((view) => view.id);
              const next = [...prev.filter((id) => allIds.includes(id))];
              for (const id of allIds) {
                if (next.length >= layout) break;
                if (!next.includes(id)) next.push(id);
              }
              return next.slice(0, layout);
            });
          }}
          onAddChannelToView={handleAddChannelToView}
          onSuperposeChannels={handleSuperposeChannels}
          views={views}
          selectedVisibleViewIds={selectedVisibleViewIds}
          onChangeVisibleViewIds={(ids) => setSelectedVisibleViewIds(ids)}
          isDark={isDark}
        />

        {/* Dynamic Graphs Grid Display Area */}
        <main
          id="visualizer-main-workspace"
          className={`flex-1 flex flex-col min-w-0 h-full p-2 sm:p-2.5 overflow-y-auto overflow-x-hidden ${
            isDark ? 'bg-[#1C1C1C]' : 'bg-[#F3F3F3]'
          }`}
        >
          {visibleViews.length === 0 ? (
            <div
              className={`flex-1 flex items-center justify-center border-2 border-dashed rounded-[4px] ${
                isDark ? 'border-[#3A3A3A] bg-[#202020]' : 'border-[#CCCCCC] bg-[#FFFFFF]'
              }`}
            >
              <div
                className={`text-center text-[13px] font-medium ${
                  isDark ? 'text-[#A0A0A0]' : 'text-[#222222]'
                }`}
              >
                No active graph views. Select or upload channels from the sidebar.
              </div>
            </div>
          ) : (
            <div
              id="graphs-grid-container"
              className={`grid ${getGridClass()} gap-2 sm:gap-2.5 w-full h-full min-h-0 min-w-0`}
            >
              {visibleViews.map((view) => (
                <div
                  key={view.id}
                  className="min-h-[220px] sm:min-h-[240px] h-full w-full min-w-0 flex flex-col"
                >
                  <InteractiveCanvasPlot
                    view={view}
                    allChannels={channels}
                    isDark={isDark}
                    isMaximized={maximizedViewId === view.id}
                    forceStackedHeader={visibleViews.length > 1}
                    onToggleMaximize={() =>
                      setMaximizedViewId(maximizedViewId === view.id ? null : view.id)
                    }
                    onUpdateView={(updated) => handleUpdateView(view.id, updated)}
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Export Report & Metrics Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        views={visibleViews}
        channels={channels}
        files={files}
        isDark={isDark}
      />

      {/* Interaction Shortcuts & Help Modal */}
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        isDark={isDark}
      />
    </div>
  );
}
