import type { Component } from "solid-js";

interface GaugeProps {
  cents: number;
  active: boolean;
}

const RADIUS = 120;
const STROKE_WIDTH = 8;
const CENTER_X = 150;
const CENTER_Y = 140;
const START_ANGLE = Math.PI;
const END_ANGLE = 0;
const NEEDLE_LENGTH = RADIUS - 10;

const TICK_VALUES = [-50, -25, -10, -5, 0, 5, 10, 25, 50];

function centsToAngle(cents: number): number {
  const clamped = Math.max(-50, Math.min(50, cents));
  const t = (clamped + 50) / 100; // 0..1
  return START_ANGLE + t * (END_ANGLE - START_ANGLE);
}

function polarToCartesian(angle: number, r: number): { x: number; y: number } {
  return {
    x: CENTER_X + r * Math.cos(angle),
    y: CENTER_Y - r * Math.sin(angle),
  };
}

function arcColor(cents: number): string {
  const absCents = Math.abs(cents);
  if (absCents <= 5) return "#4caf50";
  if (absCents <= 15) return "#ffeb3b";
  return "#f44336";
}

function describeArc(
  startAngle: number,
  endAngle: number,
  r: number,
): string {
  const start = polarToCartesian(startAngle, r);
  const end = polarToCartesian(endAngle, r);
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  // SVG arc sweeps clockwise when y increases downward, but we flip y, so sweep=0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const Gauge: Component<GaugeProps> = (props) => {
  const needleAngle = () => centsToAngle(props.active ? props.cents : 0);
  const needleTip = () => polarToCartesian(needleAngle(), NEEDLE_LENGTH);
  const color = () => (props.active ? arcColor(props.cents) : "#555");

  return (
    <svg
      viewBox="0 0 300 160"
      width="300"
      height="160"
      style={{ overflow: "visible" }}
    >
      {/* Background arc */}
      <path
        d={describeArc(START_ANGLE, END_ANGLE, RADIUS)}
        fill="none"
        stroke="#333"
        stroke-width={STROKE_WIDTH}
        stroke-linecap="round"
      />

      {/* Green zone arc (±5 cents) */}
      <path
        d={describeArc(centsToAngle(-5), centsToAngle(5), RADIUS)}
        fill="none"
        stroke="rgba(76, 175, 80, 0.3)"
        stroke-width={STROKE_WIDTH + 4}
        stroke-linecap="round"
      />

      {/* Tick marks */}
      {TICK_VALUES.map((val) => {
        const angle = centsToAngle(val);
        const inner = polarToCartesian(angle, RADIUS - 12);
        const outer = polarToCartesian(angle, RADIUS + 6);
        const labelPos = polarToCartesian(angle, RADIUS + 18);
        const isCenter = val === 0;
        return (
          <>
            <line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={isCenter ? "#4caf50" : "#666"}
              stroke-width={isCenter ? 2 : 1}
            />
            <text
              x={labelPos.x}
              y={labelPos.y}
              fill="#888"
              font-size="9"
              text-anchor="middle"
              dominant-baseline="middle"
            >
              {val > 0 ? `+${val}` : val === 0 ? "0" : `${val}`}
            </text>
          </>
        );
      })}

      {/* Needle */}
      <line
        x1={CENTER_X}
        y1={CENTER_Y}
        x2={needleTip().x}
        y2={needleTip().y}
        stroke={color()}
        stroke-width="2.5"
        stroke-linecap="round"
        style={{
          transition: "x2 100ms ease-out, y2 100ms ease-out, stroke 200ms ease",
        }}
      />

      {/* Needle pivot */}
      <circle cx={CENTER_X} cy={CENTER_Y} r="5" fill={color()} />
    </svg>
  );
};

export default Gauge;
