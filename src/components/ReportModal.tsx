import React, { useState } from 'react';
import {
  X,
  FileDown,
  Printer,
  FileSpreadsheet,
  Check,
  BarChart,
  Layers,
  Calendar,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { GraphViewConfig, DataChannel, UploadedFile } from '../types';
import { formatScientificOrFixed } from '../utils/signalAnalysis';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  views: GraphViewConfig[];
  channels: DataChannel[];
  files: UploadedFile[];
  isDark: boolean;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  views,
  channels,
  files,
  isDark,
}) => {
  const [reportTitle, setReportTitle] = useState('Laboratory Data Analysis & Verification Report');
  const [engineerName, setEngineerName] = useState('Senior Test Engineer');
  const [notes, setNotes] = useState(
    'Multi-channel acquisition verification conducted with superposition and frequency domain assessment.'
  );
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Gather active channels across all views
  const activeChannelsMap = new Map<string, DataChannel>();
  views.forEach((v) => {
    v.channelIds.forEach((cid) => {
      const ch = channels.find((c) => c.id === cid);
      if (ch) activeChannelsMap.set(ch.id, ch);
    });
  });
  const activeChannelsList = Array.from(activeChannelsMap.values());

  // Export to CSV
  const handleExportCSV = () => {
    let csv = 'Channel Name,File,Unit,Sample Count,Sampling Rate (Hz),Min,Max,Mean,Median,Std Dev,RMS,Peak-to-Peak\n';
    activeChannelsList.forEach((ch) => {
      const s = ch.stats;
      csv += `"${ch.name}","${ch.fileName}","${ch.unit}",${s.sampleCount},${
        s.samplingRateApprox ? s.samplingRateApprox.toFixed(1) : 'N/A'
      },${s.min},${s.max},${s.mean},${s.median},${s.stdDev},${s.rms},${s.peakToPeak}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Analysis_Report_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setExportSuccess('CSV Exported Successfully');
    setTimeout(() => setExportSuccess(null), 2500);
  };

  // Print Report (Triggers browser native print to PDF dialog)
  const handlePrint = () => {
    window.print();
  };

  // Download Standalone HTML Report
  const handleDownloadHTML = () => {
    const reportDate = new Date().toLocaleString();
    const rowsHtml = activeChannelsList
      .map((ch) => {
        const s = ch.stats;
        return `
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace;">${ch.name}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${ch.fileName}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${ch.unit || '—'}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${s.sampleCount.toLocaleString()}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${s.samplingRateApprox ? s.samplingRateApprox.toFixed(0) + ' Hz' : 'N/A'}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${formatScientificOrFixed(s.min, 3)}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${formatScientificOrFixed(s.max, 3)}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${formatScientificOrFixed(s.mean, 3)}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${formatScientificOrFixed(s.rms, 3)}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-family: monospace;">${formatScientificOrFixed(s.peakToPeak, 3)}</td>
        </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${reportTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; background: #fff; }
    h1 { font-size: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 4px; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th { background: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; text-align: left; font-size: 11px; text-transform: uppercase; }
    .notes-box { background: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin: 20px 0; font-size: 14px; }
    .footer { margin-top: 40px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>
  <h1>${reportTitle}</h1>
  <div class="meta">Generated on ${reportDate} | Evaluator: ${engineerName}</div>
  <div class="notes-box">
    <strong>Executive Summary:</strong><br>
    ${notes}
  </div>
  <h3>Channel Statistical Verification Metrics</h3>
  <table>
    <thead>
      <tr>
        <th>Channel</th><th>File</th><th>Unit</th><th>Points</th><th>Sampling</th><th>Min</th><th>Max</th><th>Mean</th><th>RMS</th><th>Vpp</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="footer">
    DataPlot Studio Automated Verification Engine • Monochromatic Laboratory Standard
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laboratory_Report_${Date.now()}.html`;
    link.click();
    URL.revokeObjectURL(url);

    setExportSuccess('HTML Report Downloaded');
    setTimeout(() => setExportSuccess(null), 2500);
  };

  return (
    <div
      id="report-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
    >
      <div
        id="report-modal-content"
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[4px] border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-[#2C2C2C] border-[#3A3A3A] text-[#FFFFFF]'
            : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#111111]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-6 py-3.5 border-b ${
            isDark ? 'border-[#3A3A3A] bg-[#1C1C1C]' : 'border-[#E5E5E5] bg-[#EEEEEE]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-[4px] flex items-center justify-center ${
                isDark ? 'bg-[#60CDFF] text-[#111111]' : 'bg-[#0067B8] text-white'
              }`}
            >
              <FileDown className="w-4 h-4" />
            </div>
            <div>
              <h2
                className={`text-[16px] font-semibold tracking-tight ${
                  isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
                }`}
              >
                Export Analysis Report
              </h2>
              <p className={`text-[12px] font-medium ${isDark ? 'text-[#A0A0A0]' : 'text-[#444444]'}`}>
                Generate laboratory verification sheets, snapshots, and statistical metrics.
              </p>
            </div>
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Metadata Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-[13px] font-medium mb-1.5 ${
                  isDark ? 'text-[#A0A0A0]' : 'text-[#333333]'
                }`}
              >
                Report Title
              </label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className={`w-full px-3 py-2 text-[13px] font-medium rounded-[4px] border outline-hidden transition-colors ${
                  isDark
                    ? 'bg-[#202020] border-[#3A3A3A] text-[#FFFFFF] focus:border-[#60CDFF]'
                    : 'bg-[#FFFFFF] border-[#CCCCCC] text-[#111111] focus:border-[#0067B8]'
                }`}
              />
            </div>
            <div>
              <label
                className={`block text-[13px] font-medium mb-1.5 ${
                  isDark ? 'text-[#A0A0A0]' : 'text-[#333333]'
                }`}
              >
                Engineer / Evaluator
              </label>
              <input
                type="text"
                value={engineerName}
                onChange={(e) => setEngineerName(e.target.value)}
                className={`w-full px-3 py-2 text-[13px] font-medium rounded-[4px] border outline-hidden transition-colors ${
                  isDark
                    ? 'bg-[#202020] border-[#3A3A3A] text-[#FFFFFF] focus:border-[#60CDFF]'
                    : 'bg-[#FFFFFF] border-[#CCCCCC] text-[#111111] focus:border-[#0067B8]'
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-[13px] font-medium mb-1.5 ${
                isDark ? 'text-[#A0A0A0]' : 'text-[#333333]'
              }`}
            >
              Executive Notes & Methodology
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`w-full px-3 py-2 text-[13px] font-medium rounded-[4px] border outline-hidden resize-none transition-colors ${
                isDark
                  ? 'bg-[#202020] border-[#3A3A3A] text-[#FFFFFF] focus:border-[#60CDFF]'
                  : 'bg-[#FFFFFF] border-[#CCCCCC] text-[#111111] focus:border-[#0067B8]'
              }`}
            />
          </div>

          {/* Channels Statistics Table Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3
                className={`text-[12px] font-semibold uppercase tracking-wider ${
                  isDark ? 'text-[#A0A0A0]' : 'text-[#222222]'
                }`}
              >
                Active Channels Statistical Summary ({activeChannelsList.length})
              </h3>
            </div>

            <div
              className={`overflow-x-auto rounded-[4px] border ${
                isDark ? 'border-[#3A3A3A]' : 'border-[#CCCCCC]'
              }`}
            >
              <table className="w-full text-[13px] text-left">
                <thead
                  className={`text-[11px] uppercase tracking-wider font-semibold ${
                    isDark
                      ? 'bg-[#202020] text-[#A0A0A0] border-b border-[#3A3A3A]'
                      : 'bg-[#EEEEEE] text-[#111111] border-b border-[#CCCCCC]'
                  }`}
                >
                  <tr>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Points</th>
                    <th className="py-2.5 px-3">Sampling</th>
                    <th className="py-2.5 px-3">Min</th>
                    <th className="py-2.5 px-3">Max</th>
                    <th className="py-2.5 px-3">Mean</th>
                    <th className="py-2.5 px-3">RMS</th>
                    <th className="py-2.5 px-3">Peak-to-Peak</th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y font-mono text-[13px] ${
                    isDark ? 'divide-[#3A3A3A]' : 'divide-[#E5E5E5]'
                  }`}
                >
                  {activeChannelsList.map((ch) => {
                    const s = ch.stats;
                    return (
                      <tr
                        key={ch.id}
                        className={isDark ? 'hover:bg-[#3A3A3A]/40' : 'hover:bg-[#F3F3F3]'}
                      >
                        <td className="py-2 px-3 font-medium font-sans flex items-center gap-1.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              isDark ? 'border border-white/90' : 'border border-black/80'
                            }`}
                            style={{ backgroundColor: ch.color }}
                          ></span>
                          <span
                            className={`truncate max-w-[140px] font-semibold ${
                              isDark ? 'text-[#FFFFFF]' : 'text-[#111111]'
                            }`}
                          >
                            {ch.name}
                          </span>
                          <span className={`text-[11px] font-medium ${isDark ? 'text-[#A0A0A0]' : 'text-[#444444]'}`}>
                            [{ch.unit || 'unit'}]
                          </span>
                        </td>
                        <td className="py-2 px-3">{s.sampleCount.toLocaleString()}</td>
                        <td className="py-2 px-3">
                          {s.samplingRateApprox ? `${s.samplingRateApprox.toFixed(0)} Hz` : '—'}
                        </td>
                        <td className="py-2 px-3">{formatScientificOrFixed(s.min, 2)}</td>
                        <td className="py-2 px-3">{formatScientificOrFixed(s.max, 2)}</td>
                        <td className="py-2 px-3">{formatScientificOrFixed(s.mean, 2)}</td>
                        <td
                          className={`py-2 px-3 font-semibold ${
                            isDark ? 'text-[#60CDFF]' : 'text-[#0067B8]'
                          }`}
                        >
                          {formatScientificOrFixed(s.rms, 2)}
                        </td>
                        <td className="py-2 px-3">{formatScientificOrFixed(s.peakToPeak, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer with Export Triggers */}
        <div
          className={`flex items-center justify-between px-6 py-3.5 border-t ${
            isDark ? 'border-[#3A3A3A] bg-[#1C1C1C]' : 'border-[#E5E5E5] bg-[#EEEEEE]'
          }`}
        >
          {exportSuccess ? (
            <div className="flex items-center gap-1.5 text-[13px] text-emerald-500 font-medium">
              <Check className="w-4 h-4" />
              <span>{exportSuccess}</span>
            </div>
          ) : (
            <div className={`text-[12px] ${isDark ? 'text-[#A0A0A0]' : 'text-[#5F5F5F]'}`}>
              Ready to export across multiple formats
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className={`px-3 py-1.5 rounded-[4px] text-[13px] font-medium flex items-center gap-1.5 border transition-colors ${
                isDark
                  ? 'bg-[#202020] border-[#3A3A3A] hover:bg-[#3A3A3A] text-[#FFFFFF]'
                  : 'bg-[#FFFFFF] border-[#E5E5E5] hover:bg-[#F3F3F3] text-[#111111]'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleDownloadHTML}
              className={`px-3 py-1.5 rounded-[4px] text-[13px] font-medium flex items-center gap-1.5 border transition-colors ${
                isDark
                  ? 'bg-[#202020] border-[#3A3A3A] hover:bg-[#3A3A3A] text-[#FFFFFF]'
                  : 'bg-[#FFFFFF] border-[#E5E5E5] hover:bg-[#F3F3F3] text-[#111111]'
              }`}
            >
              <FileDown className="w-4 h-4" />
              <span>HTML Report</span>
            </button>

            <button
              onClick={handlePrint}
              className={`px-4 py-1.5 rounded-[4px] text-[13px] font-semibold flex items-center gap-1.5 shadow-xs transition-colors ${
                isDark
                  ? 'bg-[#60CDFF] hover:bg-[#4cc2f9] text-[#111111]'
                  : 'bg-[#0067B8] hover:bg-[#005a9e] text-white'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
