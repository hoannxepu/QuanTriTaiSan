import { Plugin } from 'chart.js';

export function formatCompactVND(val: number, isPrivacyMode: boolean = false): string {
  if (isPrivacyMode) return '••••••';
  if (val === 0) return '0 ₫';

  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const num = (abs / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '');
    return `${sign}${num} Tỷ`;
  }
  if (abs >= 1_000_000) {
    const num = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${sign}${num} Tr`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}k`;
  }
  return `${val.toLocaleString('vi-VN')} ₫`;
}

export interface PointValuePluginOptions {
  formatValue?: (val: number, datasetIndex: number, dataset: any, dataIndex: number) => string;
  isPrivacyMode?: boolean;
  valueType?: 'currency' | 'percent';
}

export function createPointValuePlugin(options: PointValuePluginOptions = {}): Plugin<'line'> {
  return {
    id: 'pointValuePlugin',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;

      const isSmallScreen = chart.width < 460;
      const fontSize = isSmallScreen ? 9.5 : 10.5;
      const pillHeight = isSmallScreen ? 15 : 17;
      const paddingH = isSmallScreen ? 4 : 5;

      ctx.save();
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      // Group points by data index (column/time period) to resolve vertical collisions
      const pointsByIndex = new Map<number, Array<{
        datasetIndex: number;
        index: number;
        val: number;
        text: string;
        x: number;
        y: number;
        color: string;
        pillWidth: number;
      }>>();

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) return;

        meta.data.forEach((element, index) => {
          const rawVal = dataset.data[index];
          if (rawVal === null || rawVal === undefined) return;
          const val = typeof rawVal === 'number' ? rawVal : Number(rawVal);
          if (isNaN(val)) return;

          let text = '';
          if (options.formatValue) {
            text = options.formatValue(val, datasetIndex, dataset, index);
          } else if (options.valueType === 'percent') {
            text = `${Math.round(val)}%`;
          } else {
            text = formatCompactVND(val, options.isPrivacyMode);
          }

          if (!text) return;

          const { x, y } =
            typeof element.tooltipPosition === 'function'
              ? element.tooltipPosition(true)
              : { x: (element as any).x, y: (element as any).y };

          const textWidth = ctx.measureText(text).width;
          const pillWidth = textWidth + paddingH * 2;
          const color = (dataset.borderColor as string) || '#475569';

          if (!pointsByIndex.has(index)) {
            pointsByIndex.set(index, []);
          }
          pointsByIndex.get(index)!.push({
            datasetIndex,
            index,
            val,
            text,
            x,
            y,
            color,
            pillWidth,
          });
        });
      });

      // Render each column with smart collision prevention
      pointsByIndex.forEach((pts) => {
        if (pts.length === 0) return;

        // Sort points by y ascending (top of chart = lower y value)
        pts.sort((a, b) => a.y - b.y);

        interface PositionedPill {
          pt: typeof pts[0];
          pillX: number;
          pillY: number;
        }

        const positioned: PositionedPill[] = [];

        if (pts.length === 1) {
          const pt = pts[0];
          // Default: above point. If too close to top edge, place below
          let pillY = pt.y - 14 - pillHeight / 2;
          if (pillY < chartArea.top + 2) {
            pillY = pt.y + 14 - pillHeight / 2;
          }
          positioned.push({
            pt,
            pillX: pt.x - pt.pillWidth / 2,
            pillY,
          });
        } else {
          // Multiple points sharing the same vertical line
          // Group points that have almost identical Y (difference < 10px) to stagger them horizontally
          // Otherwise stack vertically
          const clusters: (typeof pts)[] = [];
          pts.forEach((pt) => {
            const cluster = clusters.find((c) => Math.abs(c[0].y - pt.y) < 10);
            if (cluster) {
              cluster.push(pt);
            } else {
              clusters.push([pt]);
            }
          });

          clusters.forEach((cluster) => {
            const count = cluster.length;
            if (count === 1) {
              const pt = cluster[0];
              let targetY = pt.y - 14 - pillHeight / 2;
              if (targetY < chartArea.top + 2) {
                targetY = pt.y + 14 - pillHeight / 2;
              }
              positioned.push({
                pt,
                pillX: pt.x - pt.pillWidth / 2,
                pillY: targetY,
              });
            } else {
              // Stagger side-by-side or slight offsets around the shared point
              const totalW = cluster.reduce((sum, p) => sum + p.pillWidth, 0) + (count - 1) * 3;
              let startX = cluster[0].x - totalW / 2;

              cluster.forEach((pt) => {
                let targetY = pt.y - 14 - pillHeight / 2;
                if (targetY < chartArea.top + 2) {
                  targetY = pt.y + 14 - pillHeight / 2;
                }
                positioned.push({
                  pt,
                  pillX: startX,
                  pillY: targetY,
                });
                startX += pt.pillWidth + 3;
              });
            }
          });

          // Sort positioned pills by pillY
          positioned.sort((a, b) => a.pillY - b.pillY);

          // Resolve vertical overlap between different clusters if they collide in both X and Y
          const minGapY = pillHeight + 2;
          for (let i = 1; i < positioned.length; i++) {
            const prev = positioned[i - 1];
            const curr = positioned[i];
            // Check if they also overlap horizontally
            const overlapX = !(curr.pillX + curr.pt.pillWidth < prev.pillX || curr.pillX > prev.pillX + prev.pt.pillWidth);
            if (overlapX && curr.pillY < prev.pillY + minGapY) {
              curr.pillY = prev.pillY + minGapY;
            }
          }

          // Check if bottom-most pill exceeded chart bottom
          const maxBottom = chartArea.bottom - 2;
          positioned.forEach((p) => {
            if (p.pillY + pillHeight > maxBottom) {
              p.pillY = maxBottom - pillHeight;
            }
            if (p.pillY < chartArea.top + 2) {
              p.pillY = chartArea.top + 2;
            }
          });
        }

        // Clamp pillX within chartArea
        positioned.forEach(({ pt, pillX, pillY }) => {
          let clampedX = pillX;
          if (clampedX < chartArea.left + 2) {
            clampedX = chartArea.left + 2;
          } else if (clampedX + pt.pillWidth > chartArea.right - 2) {
            clampedX = chartArea.right - 2 - pt.pillWidth;
          }

          // Draw pill background
          ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
          ctx.shadowBlur = 3;
          ctx.shadowOffsetY = 1;

          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(clampedX, pillY, pt.pillWidth, pillHeight, 3.5);
          } else {
            ctx.rect(clampedX, pillY, pt.pillWidth, pillHeight);
          }
          ctx.fill();

          // Border in dataset line color
          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Text in dataset line color
          ctx.fillStyle = pt.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pt.text, clampedX + pt.pillWidth / 2, pillY + pillHeight / 2);
        });
      });

      ctx.restore();
    },
  };
}
