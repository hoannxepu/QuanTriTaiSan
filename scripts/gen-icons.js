import fs from 'fs';
import { PNG } from 'pngjs';

function createPyramidPNG(size, outputPath) {
  const png = new PNG({ width: size, height: size });

  // Background colors: crisp white to soft neutral rounded rectangle
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.22; // corner radius

  // Colors
  const goldTop = [245, 158, 11, 255];      // Amber-500
  const goldLight = [251, 191, 36, 255];    // Amber-400
  const emeraldMid = [16, 185, 129, 255];   // Emerald-500
  const emeraldDark = [5, 150, 105, 255];   // Emerald-600
  const navyBot = [30, 58, 138, 255];       // Blue-900 / Navy
  const blueBot = [37, 99, 235, 255];       // Blue-600

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      // Rounded rect mask
      const dx = Math.max(Math.abs(x - cx) - (size / 2 - radius), 0);
      const dy = Math.max(Math.abs(y - cy) - (size / 2 - radius), 0);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > radius) {
        // Transparent outside rounded rect
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
        continue;
      }

      // Default white-slate background with subtle border
      let r = 255, g = 255, b = 255, a = 255;
      if (dist > radius - 2) {
        r = 226; g = 232; b = 240; // Slate-200 border
      }

      // Normalized coordinates relative to center pyramid
      const px = (x - cx) / (size * 0.42); // -1 to 1
      const py = (y - (size * 0.52)) / (size * 0.42); // -1 to 1

      // 3 Tier Pyramid Math
      // Top vertex at py = -0.75
      // Tier 1 (Gold): py between -0.75 and -0.2
      // Tier 2 (Emerald): py between -0.2 and 0.35
      // Tier 3 (Navy): py between 0.35 and 0.90

      const slope = 0.55;
      const halfWidthAtY = (py + 0.75) * slope;

      if (py >= -0.75 && py <= 0.90 && Math.abs(px) <= halfWidthAtY) {
        const isLeft = px < 0;
        
        if (py < -0.2) {
          // Tier 1: Gold
          if (isLeft) {
            r = goldLight[0]; g = goldLight[1]; b = goldLight[2];
          } else {
            r = goldTop[0]; g = goldTop[1]; b = goldTop[2];
          }
        } else if (py < 0.35) {
          // Tier 2: Emerald
          // Gap divider check
          if (py < -0.16) {
            r = 255; g = 255; b = 255; // White divider line
          } else if (isLeft) {
            r = emeraldMid[0]; g = emeraldMid[1]; b = emeraldMid[2];
          } else {
            r = emeraldDark[0]; g = emeraldDark[1]; b = emeraldDark[2];
          }
        } else {
          // Tier 3: Navy Blue
          if (py < 0.39) {
            r = 255; g = 255; b = 255; // White divider line
          } else if (isLeft) {
            r = blueBot[0]; g = blueBot[1]; b = blueBot[2];
          } else {
            r = navyBot[0]; g = navyBot[1]; b = navyBot[2];
          }
        }

        // Center spine highlight
        if (Math.abs(px) < 0.015) {
          r = Math.min(255, r + 40);
          g = Math.min(255, g + 40);
          b = Math.min(255, b + 40);
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  const buffer = PNG.sync.write(png);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated ${outputPath} (${size}x${size})`);
}

createPyramidPNG(180, 'public/apple-touch-icon.png');
createPyramidPNG(192, 'public/icon-192.png');
createPyramidPNG(512, 'public/icon-512.png');
createPyramidPNG(64, 'public/favicon.png');
