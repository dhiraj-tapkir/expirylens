"use client";

import * as d3 from "d3";
import "d3-transition"; // adds .transition() to selections
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AUCTION_START, Day, IndexName, days, formatBps, formatDay } from "@/lib/data";

const HEIGHT = 440;
const M = { top: 40, right: 20, bottom: 36, left: 64 };

// Every trading day as one dot: time across, late move up and down.
// On first load the dots fall from the zero line into place, once.
export default function Swarm({ index }: { index: IndexName }) {
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(1100);
  const [hover, setHover] = useState<{ d: Day; x: number; y: number } | null>(null);
  const played = useRef(false);
  const router = useRouter();

  const data = useMemo(() => days.filter((d) => d.index_name === index), [index]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const parse = (s: string) => new Date(`${s}T00:00:00Z`);
    const x = d3
      .scaleUtc()
      .domain(d3.extent(data, (d) => parse(d.day)) as [Date, Date])
      .range([M.left, width - M.right]);
    const y = d3.scaleLinear().domain([-60, 60]).range([HEIGHT - M.bottom, M.top]).clamp(true);
    const split = x(parse(AUCTION_START));

    svg.selectAll("*").remove();

    svg.append("rect")
      .attr("x", split).attr("y", 0).attr("width", width - split).attr("height", HEIGHT)
      .style("fill", "var(--orchid-wash)");

    const yAxis = svg.append("g").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).tickValues([-40, -20, 0, 20, 40]).tickFormat((v) => `${Number(v) > 0 ? "+" : ""}${v} bps`).tickSize(-(width - M.left - M.right)));
    yAxis.select(".domain").remove();
    yAxis.selectAll("line").style("stroke", "var(--grid)");
    yAxis.selectAll("text").style("fill", "var(--muted)").style("font-size", "12px");

    const xAxis = svg.append("g").attr("transform", `translate(0,${HEIGHT - M.bottom + 8})`)
      .call(d3.axisBottom(x).ticks(width < 640 ? 4 : 8).tickFormat((v) => d3.utcFormat("%b %y")(v as Date)).tickSize(0));
    xAxis.select(".domain").remove();
    xAxis.selectAll("text").style("fill", "var(--muted)").style("font-size", "12px");

    svg.append("line")
      .attr("x1", split).attr("x2", split).attr("y1", 0).attr("y2", HEIGHT - M.bottom)
      .style("stroke", "var(--orchid)").attr("stroke-width", 1.5).attr("stroke-dasharray", "5 5");
    svg.append("text").attr("x", M.left + 4).attr("y", 22).text("30-minute VWAP settlement")
      .style("fill", "var(--teal)").style("font-weight", 600).style("font-size", "14px");
    svg.append("text").attr("x", split + 10).attr("y", 22).text("Closing auction")
      .style("fill", "var(--orchid)").style("font-weight", 600).style("font-size", "14px");

    const color = (d: Day) => (d.is_expiry ? "var(--amber)" : d.regime === "CAS" ? "var(--orchid)" : "var(--teal)");
    const ordered = [...data].sort((a, b) => Number(a.is_expiry) - Number(b.is_expiry)); // expiries drawn on top

    const dots = svg.append("g").selectAll<SVGCircleElement, Day>("circle")
      .data(ordered, (d) => d.day)
      .join("circle")
      .attr("cx", (d) => x(parse(d.day)))
      .attr("r", (d) => (d.is_expiry ? 5.5 : 3.6))
      .style("fill", color)
      .style("fill-opacity", (d) => (d.is_expiry ? 1 : 0.55))
      .style("cursor", "pointer")
      .on("pointerenter", (event, d) => {
        d3.select(event.currentTarget).raise().transition().duration(150).attr("r", 9).style("fill-opacity", 1);
        setHover({ d, x: x(parse(d.day)), y: y(d.late_move_bps) });
      })
      .on("pointerleave", (event, d) => {
        d3.select(event.currentTarget).transition().duration(200)
          .attr("r", d.is_expiry ? 5.5 : 3.6).style("fill-opacity", d.is_expiry ? 1 : 0.55);
        setHover(null);
      })
      .on("click", (_, d) => router.push(`/explorer?index=${d.index_name}&day=${d.day}`));

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (played.current || calm) {
      dots.attr("cy", (d) => y(d.late_move_bps));
    } else {
      played.current = true;
      dots.attr("cy", y(0))
        .transition().delay((_, i) => 300 + i * 2.2).duration(900).ease(d3.easeCubicOut)
        .attr("cy", (d) => y(d.late_move_bps));
    }
  }, [data, width, router]);

  return (
    <div ref={wrap} className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Each ${index === "NIFTY" ? "Nifty 50" : "Sensex"} trading day as a dot. Late move in basis points, split at the start of the closing auction. Click a dot to open it in Explorer.`}
        className="block max-w-full"
      />
      {hover && (
        <div
          className="pointer-events-none absolute w-56 rounded-2xl border border-line bg-raised p-4"
          style={{
            left: Math.min(Math.max(hover.x - 112, 0), width - 224),
            top: hover.y < HEIGHT / 2 ? hover.y + 24 : hover.y - 120,
            boxShadow: "var(--shadow)",
          }}
        >
          <p className="m-0 text-sm font-semibold" style={{ color: hover.d.is_expiry ? "var(--amber)" : "var(--muted)" }}>
            {hover.d.is_expiry ? "Expiry day" : "Normal day"}, {hover.d.regime === "CAS" ? "auction era" : "VWAP era"}
          </p>
          <p className="m-0 mt-1 text-sm">{formatDay(hover.d.day)}</p>
          <p className="m-0 mt-1 font-display text-3xl font-extrabold">{formatBps(hover.d.late_move_bps)}</p>
          <p className="m-0 mt-1 text-xs text-muted">Click to open in Explorer</p>
        </div>
      )}
    </div>
  );
}
