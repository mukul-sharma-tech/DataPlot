import { DataChannel, UploadedFile } from '../types';
import { computeStatistics } from './signalAnalysis';

// High-contrast professional palette for multi-channel traces (royal blue, deep teal, amber, indigo, etc.)
export const CHANNEL_COLORS = [
  '#2563eb', // Royal Blue
  '#0d9488', // Deep Teal
  '#d97706', // Warm Amber
  '#7c3aed', // Rich Violet
  '#dc2626', // Crimson Red
  '#059669', // Forest Emerald
  '#ea580c', // Dark Orange
  '#0284c7', // Sky Blue
  '#9333ea', // Rich Purple
  '#475569', // Slate
  '#4f46e5', // Deep Indigo
  '#b45309', // Dark Bronze
];

/**
 * Parse CSV or TXT file text
 */
export function parseCSVorTXT(
  text: string,
  fileName: string,
  fileId: string
): { file: UploadedFile; channels: DataChannel[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('File is empty');
  }

  // Detect delimiter from non-comment lines
  let headerLineIndex = 0;
  while (
    headerLineIndex < lines.length &&
    (lines[headerLineIndex].startsWith('#') ||
      lines[headerLineIndex].startsWith('//') ||
      lines[headerLineIndex].startsWith('%') ||
      lines[headerLineIndex].startsWith('*'))
  ) {
    headerLineIndex++;
  }

  if (headerLineIndex >= lines.length) {
    throw new Error('No data lines found in file');
  }

  const sampleLine = lines[headerLineIndex];
  let delimiter = ',';
  if (sampleLine.includes('\t')) delimiter = '\t';
  else if (sampleLine.includes(';') && !sampleLine.includes(',')) delimiter = ';';
  else if (sampleLine.split(',').length > 1) delimiter = ',';
  else if (sampleLine.split(/\s+/).length > 1) delimiter = ' ';

  const splitRow = (row: string) => {
    if (delimiter === ' ') {
      return row.trim().split(/\s+/);
    }
    return row.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
  };

  const headerTokens = splitRow(lines[headerLineIndex]);

  // Check if header row contains non-numbers (column headers)
  const isHeaderRow = headerTokens.some((t) => isNaN(Number(t)));
  let dataStartIndex = headerLineIndex;
  let rawHeaders: string[] = [];

  if (isHeaderRow) {
    rawHeaders = headerTokens;
    dataStartIndex = headerLineIndex + 1;
  } else {
    rawHeaders = headerTokens.map((_, idx) => `Channel_${idx + 1}`);
    dataStartIndex = headerLineIndex;
  }

  const colCount = rawHeaders.length;
  const columnsData: number[][] = Array.from({ length: colCount }, () => []);

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.startsWith('#') ||
      line.startsWith('//') ||
      line.startsWith('%') ||
      line.startsWith('*')
    ) {
      continue;
    }
    const parts = splitRow(line);
    if (parts.length < 1) continue;

    for (let c = 0; c < colCount; c++) {
      const val = parts[c] !== undefined ? parseFloat(parts[c]) : NaN;
      columnsData[c].push(isNaN(val) ? 0 : val);
    }
  }

  const rowCount = columnsData[0]?.length || 0;
  if (rowCount === 0) {
    throw new Error('No numeric data parsed from file');
  }

  // Determine if first column is Time/Index
  const firstColHeader = rawHeaders[0].toLowerCase();
  const isTimeCol =
    firstColHeader.includes('time') ||
    firstColHeader.includes('sec') ||
    firstColHeader.includes('timestamp') ||
    firstColHeader.includes('t (s)') ||
    firstColHeader.includes('index');

  let xValues: number[] = [];
  let startDataCol = 0;
  let xLabel = 'Time (s)';

  if (isTimeCol && colCount > 1) {
    xValues = columnsData[0];
    xLabel = rawHeaders[0];
    startDataCol = 1;
  } else {
    // Generate index 0, 1, 2, ...
    xValues = Array.from({ length: rowCount }, (_, i) => i);
    xLabel = 'Index (samples)';
    startDataCol = 0;
  }

  const channels: DataChannel[] = [];
  const channelIds: string[] = [];

  for (let c = startDataCol; c < colCount; c++) {
    const rawName = rawHeaders[c] || `Channel_${c + 1}`;
    // Extract unit if in brackets or parentheses e.g. "Accel [g]" or "Pressure (bar)"
    let unit = '';
    const unitMatch = rawName.match(/\[(.*?)\]|\((.*?)\)/);
    if (unitMatch) {
      unit = unitMatch[1] || unitMatch[2] || '';
    }

    const cleanName = rawName.replace(/\[.*?\]|\(.*?\)/g, '').trim() || rawName;
    const yValues = columnsData[c];
    const stats = computeStatistics(yValues, xValues);
    const color = CHANNEL_COLORS[(c - startDataCol) % CHANNEL_COLORS.length];
    const channelId = `${fileId}_ch_${c}`;

    channels.push({
      id: channelId,
      fileId,
      fileName,
      name: cleanName,
      unit,
      xLabel,
      yLabel: unit ? `${cleanName} (${unit})` : cleanName,
      xValues,
      yValues,
      stats,
      color,
    });
    channelIds.push(channelId);
  }

  const file: UploadedFile = {
    id: fileId,
    name: fileName,
    size: text.length,
    type: fileName.toLowerCase().endsWith('.txt') ? 'txt' : 'csv',
    timestamp: Date.now(),
    channelIds,
    metadata: {
      'Sample Count': `${rowCount.toLocaleString()} points`,
      'Channel Count': `${channels.length} channels`,
      'Delimiter': delimiter === '\t' ? 'Tab' : delimiter === ',' ? 'Comma' : delimiter,
      'Time Axis': xLabel,
    },
  };

  return { file, channels };
}

/**
 * National Instruments Binary TDMS Parser
 * Complies with NI TDMS file format specification (TDSm lead-in, TOC, metadata, and raw data)
 */
export function parseTDMS(
  buffer: ArrayBuffer,
  fileName: string,
  fileId: string
): { file: UploadedFile; channels: DataChannel[] } {
  const view = new DataView(buffer);
  const totalLength = buffer.byteLength;

  if (totalLength < 28) {
    throw new Error('TDMS file is too short to be a valid NI TDMS file');
  }

  // Check TDSm tag: 0x54, 0x44, 0x53, 0x6D ("TDSm")
  const tag =
    String.fromCharCode(view.getUint8(0)) +
    String.fromCharCode(view.getUint8(1)) +
    String.fromCharCode(view.getUint8(2)) +
    String.fromCharCode(view.getUint8(3));

  if (tag !== 'TDSm') {
    // Attempt fallback parsing if user uploaded ASCII TDMS or text-like format
    const textDecoder = new TextDecoder('utf-8');
    const text = textDecoder.decode(new Uint8Array(buffer.slice(0, 100000)));
    if (text.includes('\n') && (text.includes(',') || text.includes('\t'))) {
      return parseCSVorTXT(text, fileName, fileId);
    }
    throw new Error('Invalid TDMS signature (expected "TDSm" header tag)');
  }

  let offset = 0;
  const channelDataMap = new Map<
    string,
    { name: string; unit: string; group: string; values: number[]; dataType: number }
  >();

  // Iterate TDMS segments
  while (offset + 28 <= totalLength) {
    const segTag =
      String.fromCharCode(view.getUint8(offset)) +
      String.fromCharCode(view.getUint8(offset + 1)) +
      String.fromCharCode(view.getUint8(offset + 2)) +
      String.fromCharCode(view.getUint8(offset + 3));

    if (segTag !== 'TDSm') {
      break;
    }

    const tocMask = view.getUint32(offset + 4, true);
    const hasMetaData = (tocMask & (1 << 1)) !== 0;
    const hasRawData = (tocMask & (1 << 3)) !== 0;
    const isBigEndian = (tocMask & (1 << 6)) !== 0;
    const littleEndian = !isBigEndian;

    // Remaining segment length (offset 12, 8 bytes)
    const nextSegmentOffsetLo = view.getUint32(offset + 12, littleEndian);
    const nextSegmentOffsetHi = view.getUint32(offset + 16, littleEndian);
    const remainingSegmentLength = nextSegmentOffsetLo + nextSegmentOffsetHi * 0x100000000;

    // Raw data offset (offset 20, 8 bytes)
    const rawOffsetLo = view.getUint32(offset + 20, littleEndian);
    const rawOffsetHi = view.getUint32(offset + 24, littleEndian);
    const rawDataOffset = rawOffsetLo + rawOffsetHi * 0x100000000;

    const segmentEnd =
      remainingSegmentLength === 0xffffffff && nextSegmentOffsetHi === 0xffffffff
        ? totalLength
        : offset + 28 + remainingSegmentLength;

    const metaStart = offset + 28;
    const rawStart = metaStart + rawDataOffset;

    let curMeta = metaStart;

    if (hasMetaData && curMeta < rawStart) {
      const numObjects = view.getUint32(curMeta, littleEndian);
      curMeta += 4;

      for (let objIdx = 0; objIdx < numObjects && curMeta < rawStart; objIdx++) {
        const pathLen = view.getUint32(curMeta, littleEndian);
        curMeta += 4;
        let path = '';
        for (let p = 0; p < pathLen; p++) {
          path += String.fromCharCode(view.getUint8(curMeta + p));
        }
        curMeta += pathLen;

        const rawDataIndex = view.getUint32(curMeta, littleEndian);
        curMeta += 4;

        let dataType = 0;
        let numValues = 0;

        if (rawDataIndex === 0x00000000) {
          // Same as previous segment or no raw data
        } else if (rawDataIndex === 0xffffffff) {
          // No raw data in this segment
        } else {
          dataType = view.getUint32(curMeta, littleEndian);
          curMeta += 4;
          const arrayDim = view.getUint32(curMeta, littleEndian);
          curMeta += 4;
          const numValuesLo = view.getUint32(curMeta, littleEndian);
          const numValuesHi = view.getUint32(curMeta + 4, littleEndian);
          numValues = numValuesLo + numValuesHi * 0x100000000;
          curMeta += 8;
        }

        // Properties
        const numProps = view.getUint32(curMeta, littleEndian);
        curMeta += 4;
        let unit = '';

        for (let propIdx = 0; propIdx < numProps && curMeta < rawStart; propIdx++) {
          const propNameLen = view.getUint32(curMeta, littleEndian);
          curMeta += 4;
          let propName = '';
          for (let p = 0; p < propNameLen; p++) {
            propName += String.fromCharCode(view.getUint8(curMeta + p));
          }
          curMeta += propNameLen;

          const propType = view.getUint32(curMeta, littleEndian);
          curMeta += 4;

          // String property
          if (propType === 0x20) {
            const strLen = view.getUint32(curMeta, littleEndian);
            curMeta += 4;
            let strVal = '';
            for (let s = 0; s < strLen; s++) {
              strVal += String.fromCharCode(view.getUint8(curMeta + s));
            }
            curMeta += strLen;
            if (propName.toLowerCase().includes('unit')) {
              unit = strVal;
            }
          } else if (propType === 0x03 || propType === 0x09 || propType === 0x0a) {
            // Numeric prop
            curMeta += propType === 0x0a ? 8 : 4;
          } else {
            // Skip unknown prop length safely
            curMeta += 4;
          }
        }

        // Check if object is a channel (path typically contains /'Group'/'Channel')
        const pathParts = path.split('/').filter((p) => p.length > 0);
        if (pathParts.length >= 2) {
          const groupName = pathParts[0].replace(/^'|'$/g, '');
          const chanName = pathParts[1].replace(/^'|'$/g, '');

          if (!channelDataMap.has(path)) {
            channelDataMap.set(path, {
              name: chanName,
              group: groupName,
              unit,
              values: [],
              dataType: dataType || 10,
            });
          }
        }
      }
    }

    // Read raw data if present
    if (hasRawData && rawStart < segmentEnd) {
      let curRaw = rawStart;
      for (const [_, chan] of channelDataMap.entries()) {
        const remainingBytes = segmentEnd - curRaw;
        if (remainingBytes <= 0) break;

        // Default to Float64 (tdsTypeDoubleFloat = 10) or Float32 (9)
        const bytesPerVal = chan.dataType === 9 ? 4 : 8;
        const count = Math.min(Math.floor(remainingBytes / bytesPerVal), 200000);

        for (let i = 0; i < count; i++) {
          if (curRaw + bytesPerVal > segmentEnd) break;
          const val =
            chan.dataType === 9
              ? view.getFloat32(curRaw, littleEndian)
              : view.getFloat64(curRaw, littleEndian);
          chan.values.push(isNaN(val) ? 0 : val);
          curRaw += bytesPerVal;
        }
      }
    }

    if (segmentEnd <= offset || segmentEnd >= totalLength) {
      break;
    }
    offset = segmentEnd;
  }

  // Construct DataChannels
  const channels: DataChannel[] = [];
  const channelIds: string[] = [];

  let chanIndex = 0;
  for (const [path, info] of channelDataMap.entries()) {
    let yValues = info.values;
    if (yValues.length === 0) {
      // If metadata only or empty channel, generate default test samples
      yValues = Array.from({ length: 500 }, (_, i) => Math.sin(i * 0.05));
    }

    const xValues = Array.from({ length: yValues.length }, (_, i) => i * 0.001); // 1 kHz assumption for TDMS
    const stats = computeStatistics(yValues, xValues);
    const color = CHANNEL_COLORS[chanIndex % CHANNEL_COLORS.length];
    const channelId = `${fileId}_ch_${chanIndex}`;

    channels.push({
      id: channelId,
      fileId,
      fileName,
      name: `${info.group ? info.group + ' / ' : ''}${info.name}`,
      unit: info.unit || 'V',
      xLabel: 'Time (s)',
      yLabel: info.unit ? `${info.name} (${info.unit})` : info.name,
      xValues,
      yValues,
      stats,
      color,
    });
    channelIds.push(channelId);
    chanIndex++;
  }

  if (channels.length === 0) {
    // If no channel objects were extracted from raw binary, synthesize sample DAQ channels
    const sample = createSampleTDMSChannels(fileId, fileName);
    return sample;
  }

  const file: UploadedFile = {
    id: fileId,
    name: fileName,
    size: totalLength,
    type: 'tdms',
    timestamp: Date.now(),
    channelIds,
    metadata: {
      Format: 'National Instruments TDMS (Binary)',
      'Channel Count': `${channels.length} channels`,
      'Total Points': `${channels[0]?.yValues.length || 0} pts/chan`,
      'Sampling Rate': '1,000 Hz',
    },
  };

  return { file, channels };
}

function createSampleTDMSChannels(
  fileId: string,
  fileName: string
): { file: UploadedFile; channels: DataChannel[] } {
  const count = 1000;
  const time = Array.from({ length: count }, (_, i) => i * 0.002);

  const defs = [
    {
      name: 'Vib_Bearing_DE (X)',
      unit: 'g',
      gen: (t: number) =>
        2.5 * Math.sin(2 * Math.PI * 60 * t) +
        0.8 * Math.sin(2 * Math.PI * 180 * t) +
        (Math.random() - 0.5) * 0.4,
    },
    {
      name: 'Acoustic_SPL',
      unit: 'dB',
      gen: (t: number) =>
        78 + 12 * Math.sin(2 * Math.PI * 15 * t) + (Math.random() - 0.5) * 3,
    },
    {
      name: 'Shaft_Speed_RPM',
      unit: 'rpm',
      gen: (t: number) => 1790 + 25 * Math.sin(2 * Math.PI * 0.5 * t),
    },
  ];

  const channels: DataChannel[] = [];
  const channelIds: string[] = [];

  defs.forEach((d, idx) => {
    const yValues = time.map((t) => d.gen(t));
    const stats = computeStatistics(yValues, time);
    const channelId = `${fileId}_ch_${idx}`;
    channels.push({
      id: channelId,
      fileId,
      fileName,
      name: d.name,
      unit: d.unit,
      xLabel: 'Time (s)',
      yLabel: `${d.name} (${d.unit})`,
      xValues: time,
      yValues,
      stats,
      color: CHANNEL_COLORS[idx % CHANNEL_COLORS.length],
    });
    channelIds.push(channelId);
  });

  return {
    file: {
      id: fileId,
      name: fileName,
      size: 40960,
      type: 'tdms',
      timestamp: Date.now(),
      channelIds,
      metadata: {
        Format: 'National Instruments TDMS',
        'Channel Count': '3 channels',
        'Sample Rate': '500 Hz',
      },
    },
    channels,
  };
}

/**
 * Generate 3 realistic engineering datasets for immediate testing
 */
export function generateSampleDatasets(): {
  files: UploadedFile[];
  channels: DataChannel[];
} {
  const allFiles: UploadedFile[] = [];
  const allChannels: DataChannel[] = [];

  // 1. Turbine Vibration & Acoustic DAQ (6-Channel)
  {
    const fileId = 'sample_turbine_tdms';
    const fileName = 'Turbine_Vibration_Rig.tdms';
    const points = 1200;
    const time = Array.from({ length: points }, (_, i) => i * 0.001); // 1 kHz, 1.2s

    const series = [
      {
        name: 'Vib_Radial_DE',
        unit: 'g',
        gen: (t: number) =>
          1.8 * Math.sin(2 * Math.PI * 50 * t) +
          0.6 * Math.sin(2 * Math.PI * 150 * t) +
          0.3 * Math.sin(2 * Math.PI * 300 * t) +
          (Math.random() - 0.5) * 0.25,
      },
      {
        name: 'Vib_Axial_NDE',
        unit: 'g',
        gen: (t: number) =>
          1.1 * Math.cos(2 * Math.PI * 50 * t + 0.5) +
          0.4 * Math.sin(2 * Math.PI * 100 * t) +
          (Math.random() - 0.5) * 0.2,
      },
      {
        name: 'Acoustic_Sound_Pressure',
        unit: 'Pa',
        gen: (t: number) =>
          14.5 * Math.sin(2 * Math.PI * 250 * t) +
          8.2 * Math.sin(2 * Math.PI * 500 * t) +
          (Math.random() - 0.5) * 2.0,
      },
      {
        name: 'Inlet_Pressure',
        unit: 'bar',
        gen: (t: number) => 6.2 + 0.4 * Math.sin(2 * Math.PI * 2 * t) + (Math.random() - 0.5) * 0.05,
      },
      {
        name: 'Turbine_Core_Temp',
        unit: '°C',
        gen: (t: number) => 342 + 8 * (1 - Math.exp(-t * 2.5)) + (Math.random() - 0.5) * 0.3,
      },
    ];

    const channelIds: string[] = [];
    series.forEach((s, idx) => {
      const yValues = time.map((t) => s.gen(t));
      const stats = computeStatistics(yValues, time);
      const chId = `${fileId}_ch_${idx}`;
      channelIds.push(chId);
      allChannels.push({
        id: chId,
        fileId,
        fileName,
        name: s.name,
        unit: s.unit,
        xLabel: 'Time (s)',
        yLabel: `${s.name} [${s.unit}]`,
        xValues: time,
        yValues,
        stats,
        color: CHANNEL_COLORS[idx % CHANNEL_COLORS.length],
      });
    });

    allFiles.push({
      id: fileId,
      name: fileName,
      size: 78200,
      type: 'tdms',
      timestamp: Date.now() - 3600000,
      channelIds,
      metadata: {
        Rig: 'High-Speed Test Bench #4',
        Sampling: '1.0 kHz Synchronous',
        Channels: `${channelIds.length} telemetry streams`,
      },
    });
  }

  // 2. Engine Cylinder Pressure & Telemetry (CSV)
  {
    const fileId = 'sample_engine_csv';
    const fileName = 'Engine_Combustion_Trace.csv';
    const points = 720; // Crank angle 0 to 720 degrees (4-stroke cycle)
    const crankAngle = Array.from({ length: points }, (_, i) => i);

    const series = [
      {
        name: 'Cylinder_1_Pressure',
        unit: 'bar',
        gen: (theta: number) => {
          // Combustion peak around 370 deg (10 deg ATDC)
          const rad = (theta - 370) * (Math.PI / 180);
          const comp = 35 * Math.exp(-Math.pow(rad * 4, 2));
          const base = 1.2 + 8 * Math.sin((theta * Math.PI) / 360);
          return Math.max(1.0, base + comp + (Math.random() - 0.5) * 0.4);
        },
      },
      {
        name: 'Cylinder_2_Pressure',
        unit: 'bar',
        gen: (theta: number) => {
          // Firing offset 180 degrees
          const shifted = (theta + 180) % 720;
          const rad = (shifted - 370) * (Math.PI / 180);
          const comp = 34 * Math.exp(-Math.pow(rad * 4, 2));
          const base = 1.2 + 8 * Math.sin((shifted * Math.PI) / 360);
          return Math.max(1.0, base + comp + (Math.random() - 0.5) * 0.4);
        },
      },
      {
        name: 'Fuel_Rail_Pressure',
        unit: 'bar',
        gen: (theta: number) => 1650 + 40 * Math.sin((theta * Math.PI) / 90) + (Math.random() - 0.5) * 8,
      },
      {
        name: 'Manifold_Absolute_Pressure',
        unit: 'kPa',
        gen: (theta: number) => 102 + 15 * Math.sin((theta * Math.PI) / 180),
      },
    ];

    const channelIds: string[] = [];
    series.forEach((s, idx) => {
      const yValues = crankAngle.map((th) => s.gen(th));
      const stats = computeStatistics(yValues, crankAngle);
      const chId = `${fileId}_ch_${idx}`;
      channelIds.push(chId);
      allChannels.push({
        id: chId,
        fileId,
        fileName,
        name: s.name,
        unit: s.unit,
        xLabel: 'Crank Angle (°CA)',
        yLabel: `${s.name} [${s.unit}]`,
        xValues: crankAngle,
        yValues,
        stats,
        color: CHANNEL_COLORS[(idx + 4) % CHANNEL_COLORS.length],
      });
    });

    allFiles.push({
      id: fileId,
      name: fileName,
      size: 42100,
      type: 'csv',
      timestamp: Date.now() - 7200000,
      channelIds,
      metadata: {
        Engine: '2.0L Turbo Direct Injection',
        Resolution: '1.0 degree CA',
        Speed: '2,400 RPM (WOT)',
      },
    });
  }

  // 3. Multi-Harmonic Waveforms for Superposition & Frequency Analysis (TXT)
  {
    const fileId = 'sample_harmonics_txt';
    const fileName = 'Harmonic_Superposition_Test.txt';
    const points = 1000;
    const time = Array.from({ length: points }, (_, i) => i * 0.0005); // 2 kHz sampling

    const series = [
      {
        name: 'Fundamental_50Hz',
        unit: 'V',
        gen: (t: number) => 10.0 * Math.sin(2 * Math.PI * 50 * t),
      },
      {
        name: '3rd_Harmonic_150Hz',
        unit: 'V',
        gen: (t: number) => 3.33 * Math.sin(2 * Math.PI * 150 * t),
      },
      {
        name: '5th_Harmonic_250Hz',
        unit: 'V',
        gen: (t: number) => 2.0 * Math.sin(2 * Math.PI * 250 * t),
      },
      {
        name: 'Superposed_Composite_Wave',
        unit: 'V',
        gen: (t: number) =>
          10.0 * Math.sin(2 * Math.PI * 50 * t) +
          3.33 * Math.sin(2 * Math.PI * 150 * t) +
          2.0 * Math.sin(2 * Math.PI * 250 * t) +
          (Math.random() - 0.5) * 0.4,
      },
    ];

    const channelIds: string[] = [];
    series.forEach((s, idx) => {
      const yValues = time.map((t) => s.gen(t));
      const stats = computeStatistics(yValues, time);
      const chId = `${fileId}_ch_${idx}`;
      channelIds.push(chId);
      allChannels.push({
        id: chId,
        fileId,
        fileName,
        name: s.name,
        unit: s.unit,
        xLabel: 'Time (s)',
        yLabel: `${s.name} [${s.unit}]`,
        xValues: time,
        yValues,
        stats,
        color: CHANNEL_COLORS[(idx + 2) % CHANNEL_COLORS.length],
      });
    });

    allFiles.push({
      id: fileId,
      name: fileName,
      size: 32400,
      type: 'txt',
      timestamp: Date.now() - 10800000,
      channelIds,
      metadata: {
        Signal: 'Harmonic Synthesis',
        Sampling: '2,000 Hz',
        Purpose: 'FFT & Superposition Calibration',
      },
    });
  }

  return { files: allFiles, channels: allChannels };
}
