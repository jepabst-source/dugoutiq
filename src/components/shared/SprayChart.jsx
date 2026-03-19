import { useCallback, useRef } from 'react';

// Hit type → dot color mapping
const HIT_COLORS = {
  single: '#22c55e',   // green
  double: '#3b82f6',   // blue
  triple: '#f97316',   // orange
  hr: '#eab308',       // gold
  hit: '#22c55e',      // generic hit (simple mode) → green
  out: '#78716c',      // fielded out → gray
  K: '#ef4444',        // strikeout → red (won't typically appear on chart)
};

/**
 * SprayChart — an SVG baseball field overlay.
 * 
 * Two modes:
 * 1. INPUT mode (onTap provided): Shows the field, user taps to place a hit. 
 *    Calls onTap({ x, y }) with coordinates 0-100 (percentage of field).
 * 2. DISPLAY mode (hits provided): Renders dots for all past hit locations.
 * 
 * Props:
 * @param {Function} onTap - callback({ x, y }) when field is tapped (input mode)
 * @param {Array} hits - array of { hitX, hitY, outcome } for display mode
 * @param {string} pendingOutcome - the outcome type being placed (for dot preview color)
 * @param {string} className - optional extra classes
 */
export default function SprayChart({ onTap, hits = [], pendingOutcome, className = '' }) {
  const svgRef = useRef(null);

  const handleTap = useCallback((e) => {
    if (!onTap) return;
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    // Get tap position as percentage of the SVG area
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Only register taps in the fair territory (roughly)
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      onTap({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
  }, [onTap]);

  const dotColor = (outcome) => HIT_COLORS[outcome] || '#22c55e';

  return (
    <div className={`relative ${className}`}>
      <svg
        ref={svgRef}
        viewBox="0 0 300 300"
        className="w-full max-w-[280px] mx-auto select-none"
        onClick={handleTap}
        style={{ touchAction: 'none' }}
      >
        {/* Grass background */}
        <rect x="0" y="0" width="300" height="300" fill="#2d5016" rx="12" />

        {/* Outfield arc */}
        <path
          d="M 15,280 Q 15,30 150,15 Q 285,30 285,280"
          fill="#3a6b1e"
          stroke="#4a8525"
          strokeWidth="1.5"
        />

        {/* Infield diamond */}
        <polygon
          points="150,195 200,240 150,285 100,240"
          fill="#c4956a"
          stroke="#a07850"
          strokeWidth="1"
        />

        {/* Infield grass (pitcher's circle area) */}
        <circle cx="150" cy="240" r="20" fill="#3a6b1e" stroke="#4a8525" strokeWidth="0.5" />

        {/* Base paths */}
        <line x1="150" y1="285" x2="200" y2="240" stroke="white" strokeWidth="1" opacity="0.6" />
        <line x1="200" y1="240" x2="150" y2="195" stroke="white" strokeWidth="1" opacity="0.6" />
        <line x1="150" y1="195" x2="100" y2="240" stroke="white" strokeWidth="1" opacity="0.6" />
        <line x1="100" y1="240" x2="150" y2="285" stroke="white" strokeWidth="1" opacity="0.6" />

        {/* Bases */}
        <rect x="146" y="281" width="8" height="8" fill="white" transform="rotate(45 150 285)" /> {/* Home */}
        <rect x="196" y="236" width="8" height="8" fill="white" transform="rotate(45 200 240)" /> {/* 1B */}
        <rect x="146" y="191" width="8" height="8" fill="white" transform="rotate(45 150 195)" /> {/* 2B */}
        <rect x="96" y="236" width="8" height="8" fill="white" transform="rotate(45 100 240)" />  {/* 3B */}

        {/* Pitcher's mound */}
        <rect x="148" y="238" width="4" height="4" fill="white" rx="0.5" />

        {/* Foul lines */}
        <line x1="150" y1="285" x2="15" y2="135" stroke="white" strokeWidth="1" opacity="0.4" />
        <line x1="150" y1="285" x2="285" y2="135" stroke="white" strokeWidth="1" opacity="0.4" />

        {/* Outfield fence arc (subtle) */}
        <path
          d="M 25,160 Q 25,40 150,25 Q 275,40 275,160"
          fill="none"
          stroke="white"
          strokeWidth="0.8"
          opacity="0.3"
        />

        {/* Position labels (subtle) */}
        <text x="70" y="170" fill="white" opacity="0.25" fontSize="8" textAnchor="middle">LF</text>
        <text x="150" y="130" fill="white" opacity="0.25" fontSize="8" textAnchor="middle">CF</text>
        <text x="230" y="170" fill="white" opacity="0.25" fontSize="8" textAnchor="middle">RF</text>
        <text x="120" y="225" fill="white" opacity="0.25" fontSize="7" textAnchor="middle">SS</text>
        <text x="180" y="225" fill="white" opacity="0.25" fontSize="7" textAnchor="middle">2B</text>

        {/* Tap instruction (input mode only) */}
        {onTap && (
          <text x="150" y="80" fill="white" opacity="0.5" fontSize="10" textAnchor="middle" fontWeight="600">
            Tap where the ball landed
          </text>
        )}

        {/* Render hit dots (display mode) */}
        {hits.map((h, i) => (
          h.hitX != null && h.hitY != null ? (
            <circle
              key={i}
              cx={(h.hitX / 100) * 300}
              cy={(h.hitY / 100) * 300}
              r="5"
              fill={dotColor(h.outcome)}
              stroke="white"
              strokeWidth="1"
              opacity="0.85"
            />
          ) : null
        ))}
      </svg>

      {/* Legend (display mode) */}
      {!onTap && hits.length > 0 && (
        <div className="flex justify-center gap-3 mt-2 flex-wrap">
          {[
            ['1B', '#22c55e'],
            ['2B', '#3b82f6'],
            ['3B', '#f97316'],
            ['HR', '#eab308'],
            ['Out', '#78716c'],
          ].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-chalk-muted">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
