"use client";

import * as d3 from "d3";
import "d3-transition"; // adds .transition() to selections
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Day, Finding, days, formatBps, formatDay } from "@/lib/data";

const HEIGHT = 200;
const M = { top: 16, right: 16, bottom: 36, left: 140 };

// stable pseudo-random jitter per day, so dots don't jump around between renders
function jitter(day: string) {
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) % 1000;
  return h / 1000 - 0.5;
}

// Every day in the selected group: size of the late move, normal days vs expiries.
export default function Strip({ finding }: { finding: Finding }) {
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<{ d: Day; x: number; y: number } | null>(null);
  const router = useRouter();

  const group = useMemo(
    () => days.filter((d) => d.index_name === finding.index && d.regime === finding.regime),
    [finding],
  );

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(300, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const max = Math.min(80, d3.max(group, (d) => Math.abs(d.late_move_bps)) ?? 40);
    const x = d3.scaleLinear().domain([0, max]).range([M.left, width - M.right]).nice().clamp(true);
    const rows = d3.scaleBand().domain(["normal", "expiry"]).range([M.top, HEIGHT - M.bottom]).padding(0.25);

    const axis = svg.append("g").attr("transform", `translate(0,${HEIGHT - M.bottom + 6})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat((v) => `${v} bps`).tickSize(0));
    axis.select(".domain").remove();
    axis.selectAll("text").style("fill", "var(--muted)").style("font-size", "12px");

    for (const row of ["normal", "expiry"] as const) {
      const top = rows(row) ?? 0;
      const mid = top + rows.bandwidth() / 2;
      const color = row === "expiry" ? "var(--amber)" : "var(--neutral-bar)";
      const median = row === "expiry" ? finding.expiry : finding.normal;
      const subset = group.filter((d) => d.is_expiry === (row === "expiry"));

      svg.append("text").attr("x", M.left - 14).attr("y", mid + 4).attr("text-anchor", "end")
        .text(row === "expiry" ? `Expiry days (${subset.length})` : `Normal days (${subset.length})`)
        .style("fill", "var(--text)").style("font-size", "13px");

      svg.append("g").selectAll<SVGCircleElement, Day>("circle")
        .data(subset, (d) => d.day)
        .join("circle")
        .attr("cx", (d) => x(Math.abs(d.late_move_bps)))
        .attr("cy", (d) => mid + jitter(d.day) * rows.bandwidth() * 0.8)
        .attr("r", row === "expiry" ? 5 : 3.5)
        .style("fill", color)
        .style("fill-opacity", row === "expiry" ? 0.95 : 0.6)
        .style("cursor", "pointer")
        .on("pointerenter", (event, d) => {
          d3.select(event.currentTarget).raise().transition().duration(120).attr("r", 8);
          setHover({ d, x: x(Math.abs(d.late_move_bps)), y: mid });
        })
        .on("pointerleave", (event) => {
          d3.select(event.currentTarget).transition().duration(150).attr("r", row === "expiry" ? 5 : 3.5);
          setHover(null);
        })
        .on("click", (_, d) => router.push(`/explorer?index=${d.index_name}&day=${d.day}`));

      // median marker: a tall tick with its value
      svg.append("line")
        .attr("x1", x(median)).attr("x2", x(median))
        .attr("y1", top - 4).attr("y2", top + rows.bandwidth() + 4)
        .style("stroke", "var(--text)").attr("stroke-width", 2);
      svg.append("text")
        .attr("x", x(median) + 6).attr("y", top + 8)
        .text(`median ${median.toFixed(1)}`)
        .style("fill", "var(--text)").style("font-size", "12px").style("font-weight", 600);
    }
  }, [group, finding, width, router]);

  return (
    <div ref={wrap} className="relative">
      <svg ref={svgRef} width={width} height={HEIGHT} className="block max-w-full" role="img"
        aria-label="Each day in the selected group as a dot, by size of late move, with medians marked" />
      {hover && (
        <div
          className="pointer-events-none absolute w-52 rounded-xl border border-line bg-raised px-3 py-2 text-sm"
          style={{ left: Math.min(Math.max(hover.x - 104, 0), width - 208), top: hover.y + 18, boxShadow: "var(--shadow)" }}
        >
          <p className="m-0">{formatDay(hover.d.day)}</p>
          <p className="m-0 font-semibold">{formatBps(hover.d.late_move_bps)}</p>
          <p className="m-0 text-xs text-muted">Click to open in Explorer</p>
        </div>
      )}
    </div>
  );
}
