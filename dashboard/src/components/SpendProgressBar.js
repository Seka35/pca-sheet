"use client";

/**
 * SpendProgressBar - Displays spend vs limit as a progress bar
 * Color changes based on percentage:
 * - Green (--primary-accent): 0-59%
 * - Orange (#FFB020): 60-79%
 * - Red (#FF4D4D): 80-100%
 */
export default function SpendProgressBar({ current = 0, limit = 0, showAmount = false, height = 8 }) {
  const parseAmount = (val) => {
    if (!val && val !== 0) return 0;
    const parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const currentAmount = parseAmount(current);
  const limitAmount = parseAmount(limit);

  // Calculate percentage - cap at 100%
  const percentage = limitAmount > 0 ? Math.min((currentAmount / limitAmount) * 100, 100) : 0;

  // Determine color based on percentage
  let barColor;
  if (percentage < 60) {
    barColor = 'var(--primary-accent)';
  } else if (percentage < 80) {
    barColor = '#FFB020';
  } else {
    barColor = '#FF4D4D';
  }

  const fmtUSD = (n) => {
    if (n === null || n === undefined || isNaN(n)) return '$0';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // No limit set - don't show anything
  if (!limitAmount || limitAmount === 0) {
    return <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>No limit set</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
      {/* Progress bar */}
      <div
        style={{
          height: `${height}px`,
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: '100px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Filled portion */}
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: barColor,
            borderRadius: '100px',
            transition: 'width 0.3s ease, background-color 0.3s ease',
          }}
        />
      </div>

      {/* Labels row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Percentage */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: '600',
            color: barColor,
          }}
        >
          {Math.round(percentage)}%
        </span>

        {/* Amount display */}
        {showAmount && (
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}
          >
            {fmtUSD(currentAmount)} / {fmtUSD(limitAmount)}
          </span>
        )}
      </div>
    </div>
  );
}
