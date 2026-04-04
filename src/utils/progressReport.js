/**
 * Progress Report Generator
 * Creates a clean PDF progress report using browser canvas + jsPDF.
 * Can be triggered from coach or client side.
 */

// Dynamically load jsPDF from CDN if not already loaded
async function loadJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Generate a progress report PDF
 * @param {Object} data - Client data
 * @param {string} data.clientName
 * @param {string} data.goal - e.g. 'cut', 'lean-bulk'
 * @param {Array} data.weightLog - [{date, weight}, ...]
 * @param {Object} data.measurements - {weight, waist, chest, arms, thighs} per date
 * @param {number} data.adherence - 0-100
 * @param {Object} data.weightTrend - from analyzeWeightTrend
 * @param {number} data.totalWorkouts
 * @param {number} data.totalCheckins
 * @param {string} data.startDate
 * @param {string} data.endDate
 * @param {string} data.coachName
 */
export async function generateProgressReport(data) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const margin = 16;
  const contentW = W - margin * 2;
  let y = margin;

  // ── Colors ──
  const gold = [212, 175, 55];
  const dark = [7, 9, 17];
  const darkCard = [18, 20, 32];
  const white = [255, 255, 255];
  const lightGray = [140, 140, 160];
  const green = [46, 204, 113];
  const red = [231, 76, 60];

  // ── Background ──
  doc.setFillColor(...dark);
  doc.rect(0, 0, W, H, 'F');

  // ── Header ──
  doc.setFillColor(...gold);
  doc.rect(0, 0, W, 40, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...dark);
  doc.text('PROGRESS REPORT', margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.clientName || 'Client'} · ${formatGoal(data.goal)}`, margin, 26);

  const dateRange = `${formatDate(data.startDate)} → ${formatDate(data.endDate || new Date().toISOString().slice(0, 10))}`;
  doc.text(dateRange, margin, 33);

  // Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('AESTHETIC LIFESTYLE', W - margin, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  if (data.coachName) doc.text(`Coach: ${data.coachName}`, W - margin, 24, { align: 'right' });

  y = 50;

  // ── Key Metrics Row ──
  const metrics = [];
  if (data.weightTrend) {
    metrics.push({
      label: 'Total Change',
      value: `${data.weightTrend.totalChange > 0 ? '+' : ''}${data.weightTrend.totalChange} kg`,
      color: data.goal === 'cut' ? (data.weightTrend.totalChange < 0 ? green : red) : (data.weightTrend.totalChange > 0 ? green : red),
    });
    metrics.push({
      label: 'Weekly Rate',
      value: `${data.weightTrend.weeklyRate > 0 ? '+' : ''}${data.weightTrend.weeklyRate} kg/wk`,
      color: lightGray,
    });
  }
  if (data.adherence != null) {
    metrics.push({
      label: 'Adherence',
      value: `${data.adherence}%`,
      color: data.adherence >= 80 ? green : data.adherence >= 50 ? gold : red,
    });
  }
  if (data.totalWorkouts != null) {
    metrics.push({ label: 'Workouts', value: String(data.totalWorkouts), color: gold });
  }
  if (data.totalCheckins != null) {
    metrics.push({ label: 'Check-ins', value: String(data.totalCheckins), color: gold });
  }

  if (metrics.length) {
    const cardW = (contentW - (metrics.length - 1) * 4) / metrics.length;
    metrics.forEach((m, i) => {
      const x = margin + i * (cardW + 4);
      doc.setFillColor(...darkCard);
      doc.roundedRect(x, y, cardW, 22, 3, 3, 'F');

      doc.setFontSize(7);
      doc.setTextColor(...lightGray);
      doc.text(m.label.toUpperCase(), x + cardW / 2, y + 8, { align: 'center' });

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...m.color);
      doc.text(m.value, x + cardW / 2, y + 18, { align: 'center' });
      doc.setFont('helvetica', 'normal');
    });
    y += 30;
  }

  // ── Weight Chart ──
  if (data.weightLog?.length >= 2) {
    y = drawSection(doc, 'WEIGHT TREND', y, margin, contentW, darkCard, gold, white);

    const chartX = margin + 8;
    const chartW = contentW - 16;
    const chartH = 50;
    const chartY = y;

    const weights = data.weightLog.map(w => w.weight);
    const minW = Math.min(...weights) - 1;
    const maxW = Math.max(...weights) + 1;
    const rangeW = maxW - minW || 1;

    // Draw chart background
    doc.setFillColor(...darkCard);
    doc.roundedRect(margin, chartY - 4, contentW, chartH + 20, 3, 3, 'F');

    // Grid lines
    doc.setDrawColor(50, 52, 70);
    doc.setLineWidth(0.2);
    for (let i = 0; i <= 4; i++) {
      const gy = chartY + (i / 4) * chartH;
      doc.line(chartX, gy, chartX + chartW, gy);
      const val = maxW - (i / 4) * rangeW;
      doc.setFontSize(6);
      doc.setTextColor(...lightGray);
      doc.text(`${val.toFixed(1)}`, chartX - 2, gy + 1, { align: 'right' });
    }

    // Line
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.8);
    const points = data.weightLog.map((w, i) => ({
      x: chartX + (i / (data.weightLog.length - 1)) * chartW,
      y: chartY + (1 - (w.weight - minW) / rangeW) * chartH,
    }));

    for (let i = 1; i < points.length; i++) {
      doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }

    // Dots
    points.forEach(p => {
      doc.setFillColor(...gold);
      doc.circle(p.x, p.y, 0.8, 'F');
    });

    // Date labels
    const first = data.weightLog[0];
    const last = data.weightLog[data.weightLog.length - 1];
    doc.setFontSize(6);
    doc.setTextColor(...lightGray);
    doc.text(formatDate(first.date), chartX, chartY + chartH + 6);
    doc.text(formatDate(last.date), chartX + chartW, chartY + chartH + 6, { align: 'right' });

    // Start/end weight labels
    doc.setFontSize(8);
    doc.setTextColor(...white);
    doc.text(`Start: ${first.weight} kg`, chartX, chartY + chartH + 12);
    const change = last.weight - first.weight;
    doc.setTextColor(...(change < 0 ? green : change > 0 ? red : lightGray));
    doc.text(`Now: ${last.weight} kg (${change > 0 ? '+' : ''}${change.toFixed(1)} kg)`, chartX + chartW, chartY + chartH + 12, { align: 'right' });

    y = chartY + chartH + 20;
  }

  // ── Measurements comparison ──
  if (data.measurements?.start && data.measurements?.current) {
    y = drawSection(doc, 'BODY MEASUREMENTS', y, margin, contentW, darkCard, gold, white);

    const meas = ['weight', 'waist', 'chest', 'arms', 'thighs'];
    const measLabels = { weight: 'Weight (kg)', waist: 'Waist (cm)', chest: 'Chest (cm)', arms: 'Arms (cm)', thighs: 'Thighs (cm)' };

    doc.setFillColor(...darkCard);
    doc.roundedRect(margin, y - 2, contentW, meas.length * 10 + 12, 3, 3, 'F');

    // Header
    doc.setFontSize(7);
    doc.setTextColor(...lightGray);
    doc.text('Measurement', margin + 6, y + 6);
    doc.text('Start', margin + contentW * 0.45, y + 6, { align: 'center' });
    doc.text('Current', margin + contentW * 0.65, y + 6, { align: 'center' });
    doc.text('Change', margin + contentW * 0.85, y + 6, { align: 'center' });

    y += 12;
    meas.forEach(key => {
      const start = data.measurements.start[key];
      const current = data.measurements.current[key];
      if (start == null && current == null) return;

      doc.setFontSize(8);
      doc.setTextColor(...white);
      doc.text(measLabels[key] || key, margin + 6, y + 3);

      doc.setTextColor(...lightGray);
      doc.text(start != null ? String(start) : '—', margin + contentW * 0.45, y + 3, { align: 'center' });
      doc.text(current != null ? String(current) : '—', margin + contentW * 0.65, y + 3, { align: 'center' });

      const diff = (start != null && current != null) ? current - start : null;
      if (diff != null) {
        doc.setTextColor(...(diff < 0 ? green : diff > 0 ? red : lightGray));
        doc.text(`${diff > 0 ? '+' : ''}${diff.toFixed(1)}`, margin + contentW * 0.85, y + 3, { align: 'center' });
      }

      y += 10;
    });
    y += 6;
  }

  // ── Summary / Coach notes ──
  if (data.coachNotes) {
    y = drawSection(doc, 'COACH NOTES', y, margin, contentW, darkCard, gold, white);
    doc.setFillColor(...darkCard);
    const noteLines = doc.splitTextToSize(data.coachNotes, contentW - 16);
    const noteH = noteLines.length * 5 + 10;
    doc.roundedRect(margin, y - 2, contentW, noteH, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...white);
    doc.text(noteLines, margin + 8, y + 6);
    y += noteH + 4;
  }

  // ── Footer ──
  doc.setFontSize(7);
  doc.setTextColor(...lightGray);
  doc.text(`Generated ${new Date().toLocaleDateString()} · Aesthetic Lifestyle Coaching`, W / 2, H - 10, { align: 'center' });
  doc.setFillColor(...gold);
  doc.rect(margin, H - 5, contentW, 0.5, 'F');

  // Return as blob URL for download
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

// ── Helpers ──
function drawSection(doc, title, y, margin, contentW, darkCard, gold, white) {
  doc.setFillColor(...gold);
  doc.rect(margin, y, 2, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...white);
  doc.text(title, margin + 6, y + 7);
  doc.setFont('helvetica', 'normal');
  return y + 14;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatGoal(goal) {
  const map = { cut: 'Cutting', 'lean-bulk': 'Lean Bulk', recomp: 'Body Recomp', maintenance: 'Maintenance', 'competition-prep': 'Comp Prep' };
  return map[goal] || goal || 'General';
}
