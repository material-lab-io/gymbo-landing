import sharp from 'sharp';
import { writeFileSync } from 'fs';

// 1200×630 branded OG image
// Colors: bg #2d2d2d, orange #f8623a, text #ebebe6
const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&amp;display=swap');
    </style>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#2d2d2d"/>

  <!-- Subtle grid lines -->
  <line x1="0" y1="315" x2="1200" y2="315" stroke="#ebebe6" stroke-opacity="0.04" stroke-width="1"/>
  <line x1="600" y1="0" x2="600" y2="630" stroke="#ebebe6" stroke-opacity="0.04" stroke-width="1"/>

  <!-- Orange accent bar top -->
  <rect x="0" y="0" width="1200" height="4" fill="#f8623a"/>

  <!-- G circle logo — large -->
  <circle cx="600" cy="210" r="72" fill="#f8623a"/>
  <text x="600" y="234" font-family="monospace" font-size="72" font-weight="700"
        fill="#2d2d2d" text-anchor="middle" dominant-baseline="auto">G</text>

  <!-- gymbo wordmark -->
  <text x="600" y="342" font-family="monospace" font-size="64" font-weight="700"
        fill="#ebebe6" text-anchor="middle" letter-spacing="12">gymbo</text>

  <!-- tagline -->
  <text x="600" y="408" font-family="monospace" font-size="24" font-weight="400"
        fill="#ebebe6" fill-opacity="0.5" text-anchor="middle" letter-spacing="6">
    train smarter. grow faster.
  </text>

  <!-- URL -->
  <text x="600" y="560" font-family="monospace" font-size="20" font-weight="400"
        fill="#f8623a" fill-opacity="0.8" text-anchor="middle" letter-spacing="4">
    getgymbo.com
  </text>

  <!-- Bottom accent bar -->
  <rect x="0" y="626" width="1200" height="4" fill="#f8623a"/>
</svg>
`.trim();

const buf = Buffer.from(svg);

await sharp(buf)
  .resize(1200, 630)
  .png()
  .toFile('public/og-image.png');

console.log('✓ public/og-image.png generated (1200×630)');
