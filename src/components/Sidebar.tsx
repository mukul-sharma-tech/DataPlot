import React, { useRef, useState } from 'react';
import {
  Upload,
  FileText,
  Database,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Grid,
  Search,
  Sparkles,
  Layers,
  BarChart2,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UploadedFile, DataChannel, GridLayout, GraphViewConfig } from '../types';

interface SidebarProps {
  files: UploadedFile[];
  channels: DataChannel[];
  views: GraphViewConfig[];
  selectedVisibleViewIds: string[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onFileUpload: (files: FileList) => void;
  onLoadSamples: () => void;
  onDeleteFile: (fileId: string) => void;
  gridLayout: GridLayout;
  onChangeLayout: (layout: GridLayout) => void;
  onAddChannelToView: (channelId: string) => void;
  onSuperposeChannels: (channelIds: string[]) => void;
  onChangeVisibleViewIds: (ids: string[]) => void;
  isDark: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  files,
  channels,
  views,
  selectedVisibleViewIds,
  collapsed,
  onToggleCollapse,
  onFileUpload,
  onLoadSamples,
  onDeleteFile,
  gridLayout,
  onChangeLayout,
  onAddChannelToView,
  onSuperposeChannels,
  onChangeVisibleViewIds,
  isDark,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isVisibleGraphsOpen, setIsVisibleGraphsOpen] = useState(true);
  const [isUploadedDataOpen, setIsUploadedDataOpen] = useState(true);
  const [expandedFileIds, setExpandedFileIds] = useState<Record<string, boolean>>({});
  const [selectedChannelsForSuperposition, setSelectedChannelsForSuperposition] = useState<string[]>([]);

  const toggleFileGroup = (fileId: string) => {
    setExpandedFileIds((prev) => ({
      ...prev,
      [fileId]: !(prev[fileId] ?? true),
    }));
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files);
    }
  };

  // Filter channels based on search
  const filteredChannels = channels.filter(
    (ch) =>
      ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.unit.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectForSuperposition = (id: string) => {
    if (selectedChannelsForSuperposition.includes(id)) {
      setSelectedChannelsForSuperposition(
        selectedChannelsForSuperposition.filter((cid) => cid !== id)
      );
    } else {
      setSelectedChannelsForSuperposition([...selectedChannelsForSuperposition, id]);
    }
  };

  const applySuperposition = () => {
    if (selectedChannelsForSuperposition.length > 0) {
      onSuperposeChannels(selectedChannelsForSuperposition);
      setSelectedChannelsForSuperposition([]);
    }
  };

  const toggleVisibleGraph = (viewId: string) => {
    const allAvailable = views.map((view) => view.id);
    const nextSelected = selectedVisibleViewIds.includes(viewId)
      ? selectedVisibleViewIds.filter((id) => id !== viewId)
      : [...selectedVisibleViewIds, viewId].filter((id) => allAvailable.includes(id));

    const cleaned = nextSelected.slice(Math.max(0, nextSelected.length - gridLayout));
    const safeSelection = cleaned.length > 0 ? cleaned : allAvailable.slice(0, Math.min(gridLayout, allAvailable.length));

    onChangeVisibleViewIds(safeSelection);
  };

  return (
    <aside
      id="app-sidebar"
      className={`relative flex flex-col h-full border-r transition-all duration-250 ease-in-out z-20 select-none ${
        collapsed ? 'w-14' : 'w-80 sm:w-88'
      } ${
        isDark
          ? 'bg-[#202020] border-[#3A3A3A] text-[#FFFFFF]'
          : 'bg-[#F3F3F3] border-[#E5E5E5] text-[#111111]'
      }`}
    >
      {/* Collapse Toggle Button */}
      <button
        id="sidebar-toggle-btn"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        className={`absolute -right-3.5 top-6 w-7 h-7 rounded-full border shadow-md flex items-center justify-center transition-transform z-30 ${
          isDark
            ? 'bg-[#2C2C2C] border-[#3A3A3A] text-[#FFFFFF] hover:bg-[#3A3A3A]'
            : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#111111] hover:bg-[#EEEEEE]'
        }`}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* When Collapsed: Minimal Icon Bar */}
      {collapsed ? (
        <div className="flex flex-col items-center py-4 gap-6 h-full">
          <div
            onClick={onToggleCollapse}
            title="Data Explorer"
            className={`w-9 h-9 rounded-[4px] flex items-center justify-center font-bold cursor-pointer ${
              isDark ? 'bg-[#60CDFF] text-[#111111]' : 'bg-[#0067B8] text-white'
            }`}
          >
            <BarChart2 className="w-5 h-5" />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload Files (TDMS, CSV, TXT)"
            className={`p-2.5 rounded-[4px] transition-colors ${
              isDark ? 'text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#2C2C2C]' : 'text-[#5F5F5F] hover:text-[#111111] hover:bg-[#E5E5E5]'
            }`}
          >
            <Upload className="w-5 h-5" />
          </button>

          <button
            onClick={onLoadSamples}
            title="Load Sample Datasets"
            className={`p-2.5 rounded-[4px] transition-colors ${
              isDark ? 'text-amber-400 hover:text-amber-300 hover:bg-[#2C2C2C]' : 'text-amber-600 hover:text-amber-700 hover:bg-[#E5E5E5]'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </button>

          {/* Grid Layout Shortcuts */}
          <div className="flex flex-col items-center gap-1.5 mt-auto pb-4">
            <span className={`text-[10px] font-mono ${isDark ? 'text-[#A0A0A0]' : 'text-[#5F5F5F]'}`}>
              GRID
            </span>
            {([1, 2, 4] as GridLayout[]).map((num) => (
              <button
                key={num}
                onClick={() => onChangeLayout(num)}
                title={`Layout ${num} Graphs`}
                className={`w-7 h-7 rounded-[4px] text-[13px] font-semibold flex items-center justify-center transition-colors ${
                  gridLayout === num
                    ? isDark
                      ? 'bg-[#60CDFF] text-[#111111]'
                      : 'bg-[#0067B8] text-white'
                    : isDark
                    ? 'text-[#A0A0A0] hover:bg-[#2C2C2C] hover:text-[#FFFFFF]'
                    : 'text-[#5F5F5F] hover:bg-[#E5E5E5] hover:text-[#111111]'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".tdms,.csv,.txt"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      ) : (
        /* When Expanded: Full Sidebar Experience */
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-inherit">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-[4px] flex items-center justify-center ${
                    isDark ? 'bg-[#2C2C2C] text-[#60CDFF]' : 'bg-[#E5E5E5] text-[#0067B8]'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    className={`text-[15px] font-semibold tracking-tight leading-tight ${
                      isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
                    }`}
                  >
                    Data Explorer
                  </h2>
                  <p className={`text-[11px] font-medium ${isDark ? 'text-[#A0A0A0]' : 'text-[#444444]'}`}>
                    TDMS • CSV • TXT Channels
                  </p>
                </div>
              </div>
            </div>

            {/* Grid Layout Selector: 1, 2, 3, 4, 5, 6 Graphs */}
            <div className="mt-2">
              <div
                className={`flex items-center justify-between text-[13px] font-medium mb-1.5 ${
                  isDark ? 'text-[#A0A0A0]' : 'text-[#333333]'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5" />
                  Screen Layout
                </span>
                <span className={`font-semibold ${isDark ? 'text-[#60CDFF]' : 'text-[#0067B8]'}`}>
                  {gridLayout} Visible
                </span>
              </div>
              <div
                className={`grid grid-cols-6 gap-1 p-1 rounded-[4px] border ${
                  isDark ? 'bg-[#2C2C2C] border-[#3A3A3A]' : 'bg-[#E5E5E5] border-[#CCCCCC]'
                }`}
              >
                {([1, 2, 3, 4, 5, 6] as GridLayout[]).map((num) => (
                  <button
                    key={num}
                    id={`layout-btn-${num}`}
                    onClick={() => onChangeLayout(num)}
                    title={`Display ${num} graph${num > 1 ? 's' : ''} on screen`}
                    className={`py-1 rounded-[4px] text-[13px] font-semibold transition-all ${
                      gridLayout === num
                        ? isDark
                          ? 'bg-[#60CDFF] text-[#111111] shadow-xs'
                          : 'bg-[#0067B8] text-white shadow-xs'
                        : isDark
                        ? 'text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#3A3A3A]'
                        : 'text-[#333333] hover:text-[#000000] hover:bg-[#DCDCDC]'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Upload Drop Zone: Rounded 4px border colored #CCCCCC (Light) or #3A3A3A (Dark) */}
          <div className="p-3 border-b border-inherit">
            <div
              id="upload-dropzone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{ borderRadius: '4px' }}
              className={`border-2 border-dashed p-3.5 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? isDark
                    ? 'border-[#60CDFF] bg-[#60CDFF]/10'
                    : 'border-[#0067B8] bg-[#0067B8]/10'
                  : isDark
                  ? 'border-[#3A3A3A] hover:border-[#60CDFF] bg-[#2C2C2C]'
                  : 'border-[#CCCCCC] hover:border-[#0067B8] bg-[#FFFFFF]'
              }`}
            >
              <Upload
                className={`w-5 h-5 mx-auto mb-1 ${
                  isDark ? 'text-[#60CDFF]' : 'text-[#0067B8]'
                }`}
              />
              <p
                className={`text-[13px] font-semibold ${
                  isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
                }`}
              >
                Drop TDMS, CSV or TXT
              </p>
              <p
                className={`text-[11px] font-medium mt-0.5 ${
                  isDark ? 'text-[#A0A0A0]' : 'text-[#555555]'
                }`}
              >
                or click to browse local files
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".tdms,.csv,.txt"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Quick action: Load Sample Datasets */}
            <div className="flex items-center justify-between mt-2 pt-1">
              <span className={`text-[11px] font-medium ${isDark ? 'text-[#A0A0A0]' : 'text-[#555555]'}`}>
                Need demo data?
              </span>
              <button
                id="load-sample-btn"
                onClick={onLoadSamples}
                className={`text-[11px] font-semibold flex items-center gap-1 hover:underline ${
                  isDark ? 'text-amber-400 hover:text-amber-300' : 'text-amber-700 hover:text-amber-800'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                Load Sample Datasets
              </button>
            </div>
          </div>

          {/* Superposition Action Bar (When channels are checked) */}
          {selectedChannelsForSuperposition.length > 0 && (
            <div
              className={`px-3 py-2 border-b flex items-center justify-between text-xs animate-fade-in ${
                isDark ? 'bg-[#2C2C2C] border-[#3A3A3A]' : 'bg-[#E5E5E5] border-[#CCCCCC]'
              }`}
            >
              <span
                className={`font-semibold text-[13px] ${
                  isDark ? 'text-[#60CDFF]' : 'text-[#0067B8]'
                }`}
              >
                {selectedChannelsForSuperposition.length} selected
              </span>
              <button
                onClick={applySuperposition}
                className={`px-3 py-1 rounded-[4px] text-[12px] font-semibold flex items-center gap-1 shadow-xs transition-colors ${
                  isDark
                    ? 'bg-[#60CDFF] text-[#111111] hover:bg-[#45bfff]'
                    : 'bg-[#0067B8] text-white hover:bg-[#005a9e]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Superpose in View
              </button>
            </div>
          )}

          {/* Channels & Files Browser */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {views.length > 0 && (
              <div
                className={`rounded-[4px] border overflow-hidden ${
                  isDark ? 'bg-[#202020] border-[#3A3A3A]' : 'bg-[#F3F3F3] border-[#CCCCCC]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsVisibleGraphsOpen((prev) => !prev)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left ${
                    isDark ? 'bg-[#242424]' : 'bg-[#EEEEEE]'
                  }`}
                >
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <Layers className={`w-3.5 h-3.5 ${isDark ? 'text-[#60CDFF]' : 'text-[#0067B8]'}`} />
                    Visible Graphs
                  </span>
                  {isVisibleGraphsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isVisibleGraphsOpen && (
                  <div className="p-2 space-y-1.5">
                    {views.map((view, index) => {
                      const checked = selectedVisibleViewIds.includes(view.id);
                      return (
                        <label
                          key={view.id}
                          className={`flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-[12px] cursor-pointer transition-colors ${
                            checked
                              ? isDark
                                ? 'bg-[#2C2C2C] text-[#FFFFFF]'
                                : 'bg-[#FFFFFF] text-[#111111]'
                              : isDark
                              ? 'hover:bg-[#2C2C2C] text-[#D4D4D4]'
                              : 'hover:bg-[#FFFFFF] text-[#222222]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleVisibleGraph(view.id)}
                            className={`rounded-[2px] ${isDark ? 'accent-[#60CDFF]' : 'accent-[#0067B8]'}`}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{index + 1}. {view.title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Channel Search Input */}
            <div className="relative">
              <Search
                className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 ${
                  isDark ? 'text-[#A0A0A0]' : 'text-[#555555]'
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search channels..."
                className={`w-full pl-8 pr-3 py-1.5 text-[13px] font-medium rounded-[4px] border outline-hidden transition-colors ${
                  isDark
                    ? 'bg-[#2C2C2C] border-[#3A3A3A] focus:border-[#60CDFF] text-[#FFFFFF] placeholder-[#A0A0A0]'
                    : 'bg-[#FFFFFF] border-[#CCCCCC] focus:border-[#0067B8] text-[#111111] placeholder-[#666666]'
                }`}
              />
            </div>

            {/* Uploaded Data Toggle */}
            <div
              className={`rounded-[4px] border overflow-hidden ${
                isDark ? 'bg-[#202020] border-[#3A3A3A]' : 'bg-[#F3F3F3] border-[#CCCCCC]'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsUploadedDataOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left ${
                  isDark ? 'bg-[#242424]' : 'bg-[#EEEEEE]'
                }`}
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <Database className={`w-3.5 h-3.5 ${isDark ? 'text-[#60CDFF]' : 'text-[#0067B8]'}`} />
                  Uploaded Data
                </span>
                {isUploadedDataOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {isUploadedDataOpen && (
                <div className="p-2">
                  {files.length === 0 ? (
                    <div
                      className={`text-center py-8 text-[13px] font-medium ${
                        isDark ? 'text-[#A0A0A0]' : 'text-[#444444]'
                      }`}
                    >
                      No files loaded yet. Upload your TDMS or CSV, or load samples to begin.
                    </div>
                  ) : (
                    files.map((file) => {
                      const fileChannels = filteredChannels.filter((c) => c.fileId === file.id);
                      if (fileChannels.length === 0 && searchQuery.length > 0) return null;

                      const isFileExpanded = expandedFileIds[file.id] ?? true;

                      return (
                        <div
                          key={file.id}
                          id={`file-group-${file.id}`}
                          className={`rounded-[4px] border overflow-hidden transition-all ${
                            isDark ? 'bg-[#202020] border-[#3A3A3A]' : 'bg-[#F3F3F3] border-[#CCCCCC]'
                          }`}
                        >
                          {/* File Header */}
                          <div
                            className={`flex items-center justify-between px-3 py-2 border-b text-[13px] cursor-pointer ${
                              isDark ? 'bg-[#242424] border-[#3A3A3A]' : 'bg-[#EEEEEE] border-[#CCCCCC]'
                            }`}
                            onClick={() => toggleFileGroup(file.id)}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {file.type === 'tdms' ? (
                                <Database className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-[#60CDFF]' : 'text-[#0067B8]'}`} />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              )}
                              <span
                                className={`font-semibold truncate max-w-[150px] ${
                                  isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
                                }`}
                                title={file.name}
                              >
                                {file.name}
                              </span>
                              <span
                                className={`text-[11px] font-mono font-medium uppercase ${
                                  isDark ? 'text-[#A0A0A0]' : 'text-[#444444]'
                                }`}
                              >
                                {file.type}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFileGroup(file.id);
                                }}
                                title={isFileExpanded ? 'Collapse file' : 'Expand file'}
                                className={`p-1 rounded-[4px] ${
                                  isDark ? 'text-[#A0A0A0] hover:text-[#FFFFFF]' : 'text-[#555555] hover:text-[#111111]'
                                }`}
                              >
                                {isFileExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteFile(file.id);
                                }}
                                title="Remove file"
                                className={`p-1 rounded-[4px] hover:text-rose-500 ${
                                  isDark ? 'text-[#A0A0A0]' : 'text-[#555555]'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {isFileExpanded && (
                            <div className="p-1.5 space-y-1">
                              {fileChannels.map((ch) => {
                                const isChecked = selectedChannelsForSuperposition.includes(ch.id);
                                return (
                                  <div
                                    key={ch.id}
                                    id={`channel-item-${ch.id}`}
                                    className={`group flex items-center justify-between p-2 rounded-[4px] border transition-colors ${
                                      isChecked
                                        ? isDark
                                          ? 'bg-[#2C2C2C] border-[#60CDFF]'
                                          : 'bg-[#FFFFFF] border-[#0067B8]'
                                        : isDark
                                        ? 'bg-[#2C2C2C] border-[#3A3A3A] hover:border-[#4A4A4A]'
                                        : 'bg-[#FFFFFF] border-[#E5E5E5] hover:border-[#CCCCCC]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleSelectForSuperposition(ch.id)}
                                        title="Select for superposition"
                                        className={`rounded-[2px] cursor-pointer ${
                                          isDark ? 'accent-[#60CDFF]' : 'accent-[#0067B8]'
                                        }`}
                                      />
                                      <span
                                        className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs ${
                                          isDark ? 'border border-white/90' : 'border border-black/80'
                                        }`}
                                        style={{ backgroundColor: ch.color }}
                                      ></span>
                                      <div className="min-w-0">
                                        <div
                                          className={`text-[13px] font-semibold truncate max-w-[140px] ${
                                            isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
                                          }`}
                                          title={ch.name}
                                        >
                                          {ch.name}
                                        </div>
                                        <div
                                          className={`text-[11px] font-medium ${
                                            isDark ? 'text-[#A0A0A0]' : 'text-[#444444]'
                                          }`}
                                        >
                                          {ch.unit ? `[${ch.unit}] • ` : ''}
                                          {ch.stats.sampleCount.toLocaleString()} pts
                                        </div>
                                      </div>
                                    </div>

                                    <button
                                      onClick={() => onAddChannelToView(ch.id)}
                                      title="Plot in new/active graph"
                                      className={`p-1.5 rounded-[4px] transition-colors text-[11px] font-semibold flex items-center gap-0.5 border ${
                                        isDark
                                          ? 'border-[#3A3A3A] bg-[#202020] hover:bg-[#3A3A3A] text-[#60CDFF]'
                                          : 'border-[#CCCCCC] bg-[#F3F3F3] hover:bg-[#E5E5E5] text-[#0067B8]'
                                      }`}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span className="hidden group-hover:inline text-[11px]">Plot</span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
