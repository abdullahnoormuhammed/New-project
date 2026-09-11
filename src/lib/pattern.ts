/**
 * The geometric watermark tiled behind the board.
 *
 * An eight-point star (khatim) inside a square — the simplest repeating motif in
 * Islamic geometric ornament, and one that tiles without a visible seam. Kept as
 * an inlined SVG data URI so the board has no external asset to fetch.
 */

const PATTERN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
  <g fill="none" stroke="#ffffff" stroke-width="1.1" opacity="0.9">
    <rect x="0.5" y="0.5" width="219" height="219"/>
    <path d="M110 10 L145 75 L210 110 L145 145 L110 210 L75 145 L10 110 L75 75 Z"/>
    <path d="M110 32 L133 87 L188 110 L133 133 L110 188 L87 133 L32 110 L87 87 Z"/>
    <circle cx="110" cy="110" r="26"/>
    <path d="M0 0 L44 44 M220 0 L176 44 M0 220 L44 176 M220 220 L176 176"/>
  </g>
</svg>`.trim();

export const PATTERN_URL = `data:image/svg+xml;utf8,${encodeURIComponent(PATTERN_SVG)}`;
