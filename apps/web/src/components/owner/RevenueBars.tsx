// Hand rolled SVG revenue bars: one bar per calendar day, drawn server side
// with no charting library. Colours ride the theme tokens (CSS variables
// reach inline SVG), so the chart holds in day and night without any script.
import { formatUsd } from "@svika/shared";

export interface DayNet {
  /** YYYY-MM-DD */
  day: string;
  netCents: number;
}

interface RevenueBarsProps {
  days: DayNet[];
  ariaLabel: string;
}

const WIDTH = 328;
const HEIGHT = 128;
const PLOT_TOP = 14;
const BASELINE = 100;
const LABEL_Y = 118;

export function RevenueBars({ days, ariaLabel }: RevenueBarsProps) {
  const slot = WIDTH / days.length;
  const barWidth = Math.min(16, slot * 0.62);
  const max = Math.max(1, ...days.map((d) => d.netCents));
  const labelEvery = days.length > 8 ? 2 : 1;

  return (
    <svg
      className="revenue-bars"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={ariaLabel}
    >
      <line
        x1="0"
        y1={BASELINE}
        x2={WIDTH}
        y2={BASELINE}
        stroke="var(--color-hairline)"
        strokeWidth="1"
      />
      {days.map((d, i) => {
        const x = i * slot + (slot - barWidth) / 2;
        const h = Math.round(((BASELINE - PLOT_TOP) * d.netCents) / max);
        const dayOfMonth = Number(d.day.slice(8, 10));
        return (
          <g key={d.day}>
            {d.netCents > 0 ? (
              <rect
                x={x}
                y={BASELINE - Math.max(4, h)}
                width={barWidth}
                height={Math.max(4, h)}
                rx="3"
                fill="var(--color-action)"
              >
                <title>{`${d.day} · ${formatUsd(d.netCents)}`}</title>
              </rect>
            ) : (
              <rect
                x={x}
                y={BASELINE - 2}
                width={barWidth}
                height="2"
                rx="1"
                fill="var(--color-hairline)"
              />
            )}
            {i % labelEvery === 0 && (
              <text
                x={x + barWidth / 2}
                y={LABEL_Y}
                textAnchor="middle"
                fill="var(--color-ink-mute)"
                fontFamily="var(--font-mono)"
                fontSize="9"
              >
                {dayOfMonth}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
