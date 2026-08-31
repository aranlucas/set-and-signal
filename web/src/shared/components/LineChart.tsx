import { useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateLabels } from "@/shared/hooks/use-date-labels";
import { fmtNum, fmtDate, isoOf } from "@/shared/lib/format";

const VIEWBOX_WIDTH = 340; // viewBox width; the svg stretches to its container, height comes from `height`

// points: [{ t: ms, y: num, d?: iso, m?: 0..1, note?: str }] sorted by t.
//   m    marks the point — a second reading carried by the same dot (bigger and more solid =
//        more of it). Used for effort on the weight curve, where the two belong on one line:
//        the same weight with less left in the tank is not the same session.
//   note extra text for that point's tooltip.
// opts: { height, unit, color, axes, goal, invert }
//   invert flips the y axis, for a scale that counts down as it gets harder (RIR). Without it
//   a curve of reps-in-reserve reads upside down, with the hardest sets at the floor.
interface ChartPoint {
  t: number;
  y: number;
  d?: string;
  m?: number | null;
  note?: string;
}

export default function LineChart({
  points,
  height = 150,
  unit = "",
  color = "var(--primary)",
  axes = true,
  goal = null,
  invert = false,
}: {
  points: ChartPoint[];
  height?: number;
  unit?: string;
  color?: string;
  axes?: boolean;
  goal?: number | null;
  invert?: boolean;
}) {
  const { t } = useTranslation();
  const { monthsShort } = useDateLabels();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const gradientId = `line-chart-gradient-${useId()}`;
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    iso: string;
    v: number;
    note?: string;
  } | null>(null); // { x, y, iso, v }

  // The tooltip is placed after layout, from its measured size, because the chart
  // lives in an overflow-clipped box: a fixed half-width offset (what this used to
  // do) hangs the label off the edge on the first and last point, and the clip then
  // eats it. Reading offsetWidth here also covers translated labels, which are not
  // all the same length. Writing straight to the node's style keeps this off the
  // render path — hover fires on every mouse move.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    const wrap = wrapRef.current;
    if (!hover || !tip || !wrap) return;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const M = 4; // breathing room against the clip
    const cx = (hover.x / VIEWBOX_WIDTH) * cw;
    const cy = (hover.y / height) * ch;
    tip.style.left = Math.max(M, Math.min(cw - tw - M, cx - tw / 2)) + "px";
    // Parked at the top, but dropped below the point when the point sits high
    // enough that the label would cover the very value it is reporting.
    tip.style.top = (cy < th + 14 ? Math.min(ch - th - M, cy + 14) : M) + "px";
  }, [height, hover]);

  if (!points || points.length === 0)
    return (
      <div className="px-5 py-11 text-center text-sm leading-snug text-foreground/60">
        {t("stats.noDataYet", "No data yet")}
      </div>
    );
  const chartHeight = height;
  const chartPadding = { l: axes ? 34 : 8, r: 12, t: 10, b: axes ? 22 : 8 };
  const single = points.length === 1;
  const plottedPoints = single ? [points[0], points[0]] : points;
  const firstPoint = plottedPoints.at(0);
  const finalPoint = plottedPoints.at(-1);
  if (!firstPoint || !finalPoint)
    return (
      <div className="px-5 py-11 text-center text-sm leading-snug text-foreground/60">
        {t("stats.noDataYet", "No data yet")}
      </div>
    );
  const yValues = plottedPoints.map((point) => point.y);
  let minY = Math.min(...yValues);
  let maxY = Math.max(...yValues);
  if (goal !== null && isFinite(goal)) {
    minY = Math.min(minY, goal);
    maxY = Math.max(maxY, goal);
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const yPadding = (maxY - minY) * 0.12;
  minY -= yPadding;
  maxY += yPadding;
  const firstTimestamp = firstPoint.t;
  const lastTimestamp = finalPoint.t || firstTimestamp + 1;
  const xPosition = (timestamp: number) =>
    lastTimestamp === firstTimestamp
      ? (chartPadding.l + VIEWBOX_WIDTH - chartPadding.r) / 2
      : chartPadding.l +
        ((timestamp - firstTimestamp) / (lastTimestamp - firstTimestamp)) *
          (VIEWBOX_WIDTH - chartPadding.l - chartPadding.r);
  const yPosition = (value: number) => {
    const fraction = (value - minY) / (maxY - minY);
    return (
      chartPadding.t +
      (invert ? fraction : 1 - fraction) * (chartHeight - chartPadding.t - chartPadding.b)
    );
  };

  const gridlines = [];
  if (axes) {
    const range = maxY - minY;
    const raw = range / 3;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    let step = 10 * pow;
    for (const m of [1, 2, 2.5, 5, 10])
      if (raw <= m * pow) {
        step = m * pow;
        break;
      }
    for (let value = Math.ceil(minY / step) * step; value <= maxY + 1e-9; value += step) {
      const y = yPosition(value);
      gridlines.push(
        <g key={"y" + value}>
          <line
            x1={chartPadding.l}
            y1={y}
            x2={VIEWBOX_WIDTH - chartPadding.r}
            y2={y}
            stroke="var(--chart-grid)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          <text
            x={chartPadding.l - 5}
            y={y + 3.5}
            textAnchor="end"
            fontSize="9.5"
            fill="var(--muted-foreground)"
          >
            {fmtNum(value)}
          </text>
        </g>,
      );
    }
    const firstDate = new Date(firstTimestamp);
    const lastDate = new Date(lastTimestamp);
    const ticks: {
      t: number;
      txt: string;
      anchor?: "start" | "middle" | "end";
    }[] = [];
    let monthStart = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 1);
    while (monthStart <= lastDate) {
      ticks.push({
        t: +monthStart,
        txt: monthsShort[monthStart.getMonth()],
      });
      monthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    }
    if (ticks.length === 0 && !single) {
      for (let i = 0; i <= 2; i++) {
        const timestamp = firstTimestamp + ((lastTimestamp - firstTimestamp) * i) / 2;
        const date = new Date(timestamp);
        ticks.push({
          t: timestamp,
          txt: date.getDate() + " " + monthsShort[date.getMonth()],
          anchor: i === 0 ? "start" : i === 2 ? "end" : "middle",
        });
      }
    }
    const every = Math.max(1, Math.ceil(ticks.length / 7));
    ticks.forEach((tk, i) => {
      if (i % every) return;
      const x = xPosition(tk.t);
      gridlines.push(
        <g key={"x" + tk.t}>
          <line
            x1={x}
            y1={chartPadding.t}
            x2={x}
            y2={chartHeight - chartPadding.b}
            stroke="var(--chart-grid)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          <text
            x={x}
            y={chartHeight - 7}
            textAnchor={tk.anchor || "middle"}
            fontSize="9.5"
            fill="var(--muted-foreground)"
          >
            {tk.txt}
          </text>
        </g>,
      );
    });
  }

  const polylinePoints = plottedPoints
    .map((point) => xPosition(point.t).toFixed(1) + "," + yPosition(point.y).toFixed(1))
    .join(" ");
  const hoverPoints = (single ? [points[0]] : points).map((point) => ({
    x: xPosition(point.t),
    y: yPosition(point.y),
    iso: point.d || isoOf(new Date(point.t)),
    v: point.y,
    note: point.note,
  }));
  const marked = points.some((point) => point.m !== null && point.m !== undefined);

  const onMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const c = "touches" in e ? e.touches[0] : e;
    if (!c || !("clientX" in c)) return; // runtime guard kept from JS: synthetic events can lack clientX
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const w = r.width || VIEWBOX_WIDTH;
    const vx = ((c.clientX - r.left) / w) * VIEWBOX_WIDTH;
    const firstHoverPoint = hoverPoints.at(0);
    if (!firstHoverPoint) return;
    let closestPoint = firstHoverPoint;
    hoverPoints.forEach((point) => {
      if (Math.abs(point.x - vx) < Math.abs(closestPoint.x - vx)) closestPoint = point;
    });
    setHover(closestPoint);
  };

  return (
    // The chart surface needs pointer and touch events to update its hover tooltip.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="relative touch-pan-y"
      role="application"
      aria-label={t("chart.interactiveLabel", "Interactive chart")}
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseDown={onMove}
      onMouseLeave={() => setHover(null)}
      onTouchStart={onMove}
      onTouchMove={onMove}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${chartHeight}`}
        preserveAspectRatio="none"
        style={{ aspectRatio: `${VIEWBOX_WIDTH}/${chartHeight}` }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridlines}
        {goal !== null && isFinite(goal) && (
          <>
            <line
              x1={chartPadding.l}
              y1={yPosition(goal)}
              x2={VIEWBOX_WIDTH - chartPadding.r}
              y2={yPosition(goal)}
              stroke="var(--warning)"
              strokeWidth="1.6"
              strokeDasharray="7 4"
            />
            <text
              x={VIEWBOX_WIDTH - chartPadding.r - 2}
              y={yPosition(goal) - 5}
              textAnchor="end"
              fontSize="9.5"
              fontWeight="700"
              fill="var(--warning)"
            >
              {fmtNum(goal)}
            </text>
          </>
        )}
        <polygon
          points={`${chartPadding.l},${chartHeight - chartPadding.b} ${polylinePoints} ${xPosition(finalPoint.t).toFixed(1)},${chartHeight - chartPadding.b}`}
          fill={`url(#${gradientId})`}
        />
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {marked &&
          plottedPoints.map((point) =>
            point.m === null || point.m === undefined ? null : (
              <circle
                key={"m" + point.t}
                cx={xPosition(point.t)}
                cy={yPosition(point.y)}
                r={2.4 + point.m * 3}
                fill={color}
                opacity={0.3 + point.m * 0.7}
              />
            ),
          )}
        <circle cx={xPosition(finalPoint.t)} cy={yPosition(finalPoint.y)} r="4" fill={color} />
        {hover && (
          <g>
            <line
              x1={hover.x}
              y1={chartPadding.t}
              x2={hover.x}
              y2={chartHeight - chartPadding.b}
              stroke="var(--foreground-subtle)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <line
              x1={chartPadding.l}
              y1={hover.y}
              x2={VIEWBOX_WIDTH - chartPadding.r}
              y2={hover.y}
              stroke="var(--foreground-subtle)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r="5"
              fill={color}
              stroke="var(--background)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute top-0 left-0 max-w-full overflow-hidden rounded-sm bg-muted px-2.5 py-1 text-xs font-medium text-ellipsis whitespace-nowrap shadow-md"
          ref={tipRef}
        >
          {fmtDate(t, hover.iso, true)} · {fmtNum(hover.v)}
          {unit ? " " + unit : ""}
          {hover.note ? " · " + hover.note : ""}
        </div>
      )}
    </div>
  );
}
