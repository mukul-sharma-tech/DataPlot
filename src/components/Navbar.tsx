import React from 'react';
import {
  Sun,
  Moon,
  RotateCcw,
  FileDown,
  HelpCircle,
  Activity,
} from 'lucide-react';

interface NavbarProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onResetAllViews: () => void;
  onOpenReportModal: () => void;
  onOpenHelpModal: () => void;
  activeGraphCount: number;
  totalChannelCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  isDark,
  onToggleTheme,
  onResetAllViews,
  onOpenReportModal,
  onOpenHelpModal,
  activeGraphCount,
  totalChannelCount,
}) => {
  return (
    <header
      id="app-navbar"
      className={`h-13 border-b flex items-center justify-between px-4 select-none shrink-0 transition-colors z-10 ${
        isDark
          ? 'bg-[#1C1C1C] border-[#3A3A3A] text-[#FFFFFF]'
          : 'bg-[#EEEEEE] border-[#E5E5E5] text-[#111111]'
      }`}
    >
      {/* Left branding & channel status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-[4px] flex items-center justify-center shadow-xs ${
              isDark ? 'bg-[#60CDFF] text-[#111111]' : 'bg-[#0067B8] text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[16px] font-semibold tracking-tight leading-tight ${
                  isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
                }`}
              >
                DataPlot Studio
              </span>
              <span
                className={`hidden sm:inline-block text-[11px] uppercase font-mono px-1.5 py-0.5 rounded-[4px] border font-medium ${
                  isDark
                    ? 'bg-[#2C2C2C] border-[#3A3A3A] text-[#A0A0A0]'
                    : 'bg-[#FFFFFF] border-[#CCCCCC] text-[#222222]'
                }`}
              >
                Precision DAQ
              </span>
            </div>
          </div>
        </div>

        <div
          className={`hidden md:flex items-center gap-2 pl-3 border-l text-[13px] font-medium ${
            isDark ? 'border-[#3A3A3A] text-[#A0A0A0]' : 'border-[#CCCCCC] text-[#333333]'
          }`}
        >
          <span>{totalChannelCount} channels loaded</span>
          <span>•</span>
          <span>{activeGraphCount} active graphs</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Reset All Views Button */}
        <button
          id="navbar-reset-all-btn"
          onClick={onResetAllViews}
          title="Reset All Graph Views to 100% full extent"
          className={`px-3 py-1.5 rounded-[4px] text-[13px] font-medium transition-colors flex items-center gap-1.5 border ${
            isDark
              ? 'bg-[#2C2C2C] border-[#3A3A3A] hover:bg-[#3A3A3A] text-[#FFFFFF]'
              : 'bg-[#FFFFFF] border-[#E5E5E5] hover:bg-[#F3F3F3] text-[#111111]'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset Views</span>
        </button>

        {/* Export Report & Snapshots Button */}
        <button
          id="navbar-export-report-btn"
          onClick={onOpenReportModal}
          title="Generate and export comprehensive analysis report"
          className={`px-3.5 py-1.5 rounded-[4px] text-[13px] font-semibold transition-colors flex items-center gap-1.5 shadow-xs ${
            isDark
              ? 'bg-[#60CDFF] hover:bg-[#4ec5ff] text-[#111111]'
              : 'bg-[#0067B8] hover:bg-[#005a9e] text-white'
          }`}
        >
          <FileDown className="w-3.5 h-3.5" />
          <span>Export Report</span>
        </button>

        {/* Dark Mode Toggle */}
        <button
          id="theme-toggle-btn"
          onClick={onToggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className={`p-2 rounded-[4px] border transition-colors ${
            isDark
              ? 'bg-[#2C2C2C] border-[#3A3A3A] hover:bg-[#3A3A3A] text-amber-400'
              : 'bg-[#FFFFFF] border-[#E5E5E5] hover:bg-[#F3F3F3] text-[#5F5F5F]'
          }`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Shortcuts / Help modal */}
        <button
          id="help-modal-btn"
          onClick={onOpenHelpModal}
          title="View Interaction Guide & Keyboard Controls"
          className={`p-2 rounded-[4px] border transition-colors ${
            isDark
              ? 'bg-[#2C2C2C] border-[#3A3A3A] hover:bg-[#3A3A3A] text-[#A0A0A0]'
              : 'bg-[#FFFFFF] border-[#E5E5E5] hover:bg-[#F3F3F3] text-[#5F5F5F]'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
