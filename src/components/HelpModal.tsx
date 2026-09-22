import React from 'react';
import {
  X,
  MousePointer,
  RotateCcw,
  Move,
  Layers,
  ZoomIn,
  Radio,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, isDark }) => {
  if (!isOpen) return null;

  const shortcuts = [
    {
      icon: <ZoomIn className="w-4 h-4 text-cyan-400" />,
      title: 'Box Selection Zoom',
      desc: 'Click and drag a marquee rectangle on any plot to zoom into that precise X & Y region.',
    },
    {
      icon: <RotateCcw className="w-4 h-4 text-amber-400" />,
      title: 'Right-Click Step-Back Zoom Out',
      desc: 'Right-click anywhere on the canvas to step back to the previous zoom state. If you zoomed 4 times, 4 right-clicks will gradually revert back to the 100% full view.',
    },
    {
      icon: <Move className="w-4 h-4 text-emerald-400" />,
      title: 'Smooth Pan Navigation',
      desc: 'Hold Middle Mouse Button, Shift+Drag, or activate the Pan (Hand) tool to drag and slide across the data visualization smoothly.',
    },
    {
      icon: <MousePointer className="w-4 h-4 text-purple-400" />,
      title: 'Mouse Wheel Precision Zoom',
      desc: 'Scroll mouse wheel up/down over the plot to zoom in and out centered precisely around your cursor position.',
    },
    {
      icon: <Layers className="w-4 h-4 text-pink-400" />,
      title: 'Graph Superposition',
      desc: 'Superimpose multiple data series into a single graph view for direct multi-sensor comparison. Click series in the legend to toggle visibility or double-click to isolate.',
    },
    {
      icon: <Radio className="w-4 h-4 text-blue-400" />,
      title: 'Dual Delta Cursors [A / B]',
      desc: 'Toggle the Dual Cursor icon to place Marker A and Marker B, showing exact ΔX, ΔY, and 1/ΔX (Hz frequency) intervals.',
    },
  ];

  return (
    <div
      id="help-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
    >
      <div
        id="help-modal-content"
        className={`w-full max-w-2xl rounded-[4px] border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-[#2C2C2C] border-[#3A3A3A] text-[#FFFFFF]'
            : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#111111]'
        }`}
      >
        <div
          className={`flex items-center justify-between px-6 py-3.5 border-b ${
            isDark ? 'border-[#3A3A3A] bg-[#1C1C1C]' : 'border-[#E5E5E5] bg-[#EEEEEE]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className={`w-4 h-4 ${isDark ? 'text-[#60CDFF]' : 'text-[#0067B8]'}`} />
            <h2
              className={`text-[16px] font-semibold tracking-tight ${
                isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
              }`}
            >
              Interactive Controls & Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-[4px] transition-colors ${
              isDark
                ? 'text-[#A0A0A0] hover:text-[#FFFFFF] hover:bg-[#3A3A3A]'
                : 'text-[#444444] hover:text-[#000000] hover:bg-[#E5E5E5]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {shortcuts.map((s, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-[4px] border flex gap-3 ${
                  isDark
                    ? 'bg-[#202020] border-[#3A3A3A]'
                    : 'bg-[#F3F3F3] border-[#CCCCCC]'
                }`}
              >
                <div className="mt-0.5 shrink-0">{s.icon}</div>
                <div>
                  <h3
                    className={`text-[13px] font-semibold mb-1 ${
                      isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
                    }`}
                  >
                    {s.title}
                  </h3>
                  <p className={`text-[12px] leading-relaxed ${isDark ? 'text-[#A0A0A0]' : 'text-[#333333]'}`}>
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div
            className={`p-3 rounded-[4px] text-[12px] border ${
              isDark
                ? 'bg-[#202020] border-[#3A3A3A] text-[#A0A0A0]'
                : 'bg-[#F3F3F3] border-[#CCCCCC] text-[#222222]'
            }`}
          >
            <strong className={isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'}>Supported Formats:</strong> National Instruments TDMS (.tdms binary and ASCII), Comma/Tab/Space-separated CSV (.csv), Delimited TXT (.txt).
          </div>
        </div>

        <div
          className={`flex justify-end px-6 py-3 border-t ${
            isDark ? 'border-[#3A3A3A] bg-[#1C1C1C]' : 'border-[#E5E5E5] bg-[#EEEEEE]'
          }`}
        >
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-[4px] text-[13px] font-semibold shadow-xs transition-colors ${
              isDark
                ? 'bg-[#60CDFF] hover:bg-[#4cc2f9] text-[#111111]'
                : 'bg-[#0067B8] hover:bg-[#005a9e] text-white'
            }`}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
