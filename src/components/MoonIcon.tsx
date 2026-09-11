import { moonPhase, moonTerminatorPath } from '../lib/moon';

/**
 * The moon drawn to its real phase for the given instant — a dark disc with the
 * lit portion painted over it. Masjid boards carry this for the lunar month.
 */
export function MoonIcon({ date, size = 92 }: { date: Date; size?: number }) {
  const phase = moonPhase(date);
  const radius = size / 2 - 2;
  const path = moonTerminatorPath(phase.fraction, radius);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <radialGradient id="moon-lit" cx="38%" cy="34%">
          <stop offset="0%" stopColor="#fffdf5" />
          <stop offset="70%" stopColor="#efe6cf" />
          <stop offset="100%" stopColor="#cbbf9f" />
        </radialGradient>
      </defs>
      <g transform={`translate(${size / 2} ${size / 2})`}>
        {/* Earthshine: at new moon the disc is unlit, but it should still read
            as a moon rather than an empty hole. */}
        <circle r={radius} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.22)" />
        {phase.illumination > 0.01 ? <path d={path} fill="url(#moon-lit)" /> : null}
        {/* A couple of craters, purely so it does not read as a flat sticker. */}
        <g opacity="0.14" fill="#6b6350">
          <circle cx={-radius * 0.24} cy={-radius * 0.18} r={radius * 0.17} />
          <circle cx={radius * 0.28} cy={radius * 0.3} r={radius * 0.12} />
          <circle cx={radius * 0.06} cy={-radius * 0.42} r={radius * 0.09} />
        </g>
      </g>
    </svg>
  );
}

export function MoonWidget({ date }: { date: Date }) {
  const phase = moonPhase(date);
  return (
    <div className="panel moon-widget">
      <MoonIcon date={date} size={78} />
      <div className="moon-text">
        <div className="phase">{phase.name}</div>
        <div className="detail">
          {Math.round(phase.illumination * 100)}% illuminated · {phase.ageDays.toFixed(1)} days old
        </div>
      </div>
    </div>
  );
}
