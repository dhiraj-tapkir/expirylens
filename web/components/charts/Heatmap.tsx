"use client";

// GitHub style calendar: one square per session, brighter means a bigger late move.
import * as d3 from "d3";
import "d3-transition";
import { useEffect, useMemo, useRef, useState } from "react";
import { AUCTION_START, days, formatBps, formatDay, type Day, type IndexName } from "@/lib/data";

const M = { top: 34, right: 8, bottom: 8, left: 36 };
const ROWS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = d3.utcFormat("%Y-%m-%d");
const [FIRST, LAST] = d3.extent(days, (d) => parse(d.day)) as [Date, Date];
const START = d3.utcMonday.floor(FIRST);
const col = (date: Date) => d3.utcMonday.count(START, date);
const row = (date: Date) => (date.getUTCDay() + 6) % 7; // Monday on top

// square root so mid sized moves still show up; 30 bps and above is full strength
export const strength = d3.scaleSqrt().domain([0, 30]).range([0.12, 1]).clamp(true);

type Props = { index: IndexName; selected: Day | null; onSelect: (d: Day) => void };

export default function Heatmap({ index, selected, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ d: Day; x: number; y: number } | null>(null);
  const pick = useRef(onSelect);
  const played = useRef(false);

  const mine = useMemo(() => days.filter((d) => d.index_name === index), [index]);
  const cols = col(LAST) + 1;
  const cell = width ? Math.max(9, Math.floor((width - M.left - M.right) / cols)) : 0;
  const height = M.top + cell * 7 + M.bottom;

  useEffect(() => {
    pick.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || cell === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const gap = cell > 12 ? 3 : 2;
    const size = cell - gap;
    const X = (date: Date) => M.left + col(date) * cell;
    const Y = (date: Date) => M.top + row(date) * cell;

    // auction era backdrop
    const a = X(parse(AUCTION_START));
    svg.append("rect")
      .attr("x", a - gap).attr("y", M.top - gap)
      .attr("width", M.left + cols * cell - a + gap).attr("height", cell * 7 + gap)
      .attr("rx", 6).style("fill", "var(--orchid-wash)");
    svg.append("text").attr("x", a).attr("y", 11)
      .style("fill", "var(--orchid)").style("font-size", "11px").style("font-weight", "600")
      .text("Auction era");

    svg.append("g").selectAll("text")
      .data(d3.utcMonths(d3.utcMonth.ceil(START), LAST))
      .join("text")
      .attr("x", (m) => X(m)).attr("y", M.top - 10)
      .style("fill", "var(--muted)").style("font-size", "11px")
      .text((m) => d3.utcFormat(m.getUTCMonth() === 0 ? "%b %Y" : "%b")(m));

    svg.append("g").selectAll("text").data(ROWS).join("text")
      .attr("x", M.left - 8).attr("y", (_, i) => M.top + i * cell + size / 2 + 4)
      .attr("text-anchor", "end")
      .style("fill", "var(--muted)").style("font-size", "10px")
      .text((t) => t);

    // weekdays with no session: holidays
    const have = new Set(mine.map((d) => d.day));
    const quiet = d3.utcDays(FIRST, d3.utcDay.offset(LAST, 1)).filter((t) => row(t) < 5 && !have.has(iso(t)));
    svg.append("g").selectAll("rect").data(quiet).join("rect")
      .attr("x", (t) => X(t)).attr("y", (t) => Y(t))
      .attr("width", size).attr("height", size).attr("rx", 3)
      .style("fill", "none").style("stroke", "var(--muted)").style("stroke-opacity", 0.5)
      .style("stroke-dasharray", "2 2");

    const cells = svg.append("g").selectAll<SVGRectElement, Day>("rect").data(mine).join("rect")
      .attr("x", (d) => X(parse(d.day))).attr("y", (d) => Y(parse(d.day)))
      .attr("width", size).attr("height", size).attr("rx", 3)
      .style("fill", "var(--text)")
      .style("fill-opacity", (d) => strength(Math.abs(d.late_move_bps)));

    svg.append("g").attr("pointer-events", "none").selectAll("rect")
      .data(mine.filter((d) => d.is_expiry)).join("rect")
      .attr("x", (d) => X(parse(d.day)) + 1).attr("y", (d) => Y(parse(d.day)) + 1)
      .attr("width", size - 2).attr("height", size - 2).attr("rx", 2.5)
      .style("fill", "none").style("stroke", "var(--amber)").style("stroke-width", 2);

    if (selected && selected.index_name === index) {
      const t = parse(selected.day);
      svg.append("rect").attr("pointer-events", "none")
        .attr("x", X(t) - 2.5).attr("y", Y(t) - 2.5)
        .attr("width", size + 5).attr("height", size + 5).attr("rx", 5)
        .style("fill", "none").style("stroke", "var(--teal)").style("stroke-width", 2.5);
    }

    // sweep in week by week, once
    if (!played.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      played.current = true;
      cells.style("fill-opacity", 0)
        .transition().delay((d) => 150 + col(parse(d.day)) * 14).duration(400)
        .style("fill-opacity", (d) => strength(Math.abs(d.late_move_bps)));
    }

    cells
      .on("pointerenter", (_, d) => setHover({ d, x: X(parse(d.day)) + size / 2, y: Y(parse(d.day)) }))
      .on("pointerleave", () => setHover(null))
      .on("click", (_, d) => pick.current(d));
  }, [mine, cell, cols, index, selected]);

  return (
    <div ref={wrap} className="relative overflow-x-auto">
      <svg
        ref={svgRef}
        width={Math.max(width, M.left + cols * cell + M.right)}
        height={height}
        className="block"
        role="img"
        aria-label={`Calendar of late moves for ${index}, one square per session`}
      />
      {hover && (
        <div
          className="pointer-events-none absolute w-48 rounded-2xl border border-line bg-raised p-3"
          style={{
            left: Math.min(Math.max(hover.x - 96, 0), width - 192),
            top: hover.y < 80 ? hover.y + cell + 6 : hover.y - 78,
            boxShadow: "var(--shadow)",
          }}
        >
          <p className="text-xs text-muted">{formatDay(hover.d.day)}</p>
          <p className="font-display text-lg font-bold" style={{ color: hover.d.is_expiry ? "var(--amber)" : "var(--text)" }}>
            {formatBps(hover.d.late_move_bps)}
          </p>
          <p className="text-xs text-muted">{hover.d.is_expiry ? "Expiry day" : "Normal day"}</p>
        </div>
      )}
    </div>
  );
}
