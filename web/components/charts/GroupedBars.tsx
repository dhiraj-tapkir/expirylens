"use client";

import * as d3 from "d3";
import "d3-transition"; // adds .transition() to selections
import { useEffect, useRef, useState } from "react";
import { Finding, INDEX_LABEL, REGIME_LABEL } from "@/lib/data";

const HEIGHT = 380;
const M = { top: 28, right: 12, bottom: 64, left: 56 };

// Normal vs expiry median for each index and era. Click a pair to select it.
export default function GroupedBars({
  rows,
  selected,
  onSelect,
}: {
  rows: Finding[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(720);
  const grown = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const x = d3.scaleBand().domain(rows.map((r) => r.key)).range([M.left, width - M.right]).padding(0.22);
    const inner = d3.scaleBand().domain(["normal", "expiry"]).range([0, x.bandwidth()]).padding(0.12);
    const top = Math.ceil((d3.max(rows, (r) => r.expiry) ?? 20) / 5) * 5 + 2;
    const y = d3.scaleLinear().domain([0, top]).range([HEIGHT - M.bottom, M.top]);

    const axis = svg.append("g").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat((v) => `${v} bps`).tickSize(-(width - M.left - M.right)));
    axis.select(".domain").remove();
    axis.selectAll("line").style("stroke", "var(--grid)");
    axis.selectAll("text").style("fill", "var(--muted)").style("font-size", "12px");

    const groups = svg.append("g").selectAll<SVGGElement, typeof rows[number]>("g")
      .data(rows, (r) => r.key)
      .join("g")
      .attr("transform", (r) => `translate(${x(r.key)},0)`)
      .style("cursor", "pointer")
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-pressed", (r) => String(r.key === selected))
      .attr("aria-label", (r) => `${INDEX_LABEL[r.index]}, ${REGIME_LABEL[r.regime]}: normal ${r.normal} bps, expiry ${r.expiry} bps`)
      .on("click", (_, r) => onSelect(r.key))
      .on("keydown", (event: KeyboardEvent, r) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(r.key);
        }
      });

    // a soft highlight behind the selected pair
    groups.append("rect")
      .attr("x", -8).attr("y", M.top - 16)
      .attr("width", x.bandwidth() + 16).attr("height", HEIGHT - M.bottom - M.top + 16)
      .attr("rx", 14)
      .style("fill", (r) => (r.key === selected ? "var(--raised)" : "transparent"))
      .style("stroke", (r) => (r.key === selected ? (r.regime === "CAS" ? "var(--orchid)" : "var(--teal)") : "none"));

    const bars = [
      { kind: "normal", value: (r: Finding) => r.normal, color: "var(--neutral-bar)" },
      { kind: "expiry", value: (r: Finding) => r.expiry, color: "var(--amber)" },
    ];

    for (const bar of bars) {
      const rects = groups.append("rect")
        .attr("x", inner(bar.kind) ?? 0)
        .attr("width", inner.bandwidth())
        .attr("rx", 6)
        .style("fill", bar.color)
        .style("opacity", (r) => (r.key === selected || bar.kind === "normal" ? 1 : 0.7));

      groups.append("text")
        .attr("x", (inner(bar.kind) ?? 0) + inner.bandwidth() / 2)
        .attr("y", (r) => y(bar.value(r)) - 8)
        .attr("text-anchor", "middle")
        .text((r) => bar.value(r).toFixed(1))
        .style("fill", bar.kind === "expiry" ? "var(--amber)" : "var(--muted)")
        .style("font-size", "13px")
        .style("font-weight", bar.kind === "expiry" ? 600 : 400);

      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (grown.current || calm) {
        rects.attr("y", (r) => y(bar.value(r))).attr("height", (r) => y(0) - y(bar.value(r)));
      } else {
        rects.attr("y", y(0)).attr("height", 0)
          .transition().duration(800).delay((_, i) => 150 + i * 120).ease(d3.easeCubicOut)
          .attr("y", (r) => y(bar.value(r))).attr("height", (r) => y(0) - y(bar.value(r)));
      }
    }
    grown.current = true;

    // index and era under each pair
    groups.append("text")
      .attr("x", x.bandwidth() / 2).attr("y", HEIGHT - M.bottom + 24)
      .attr("text-anchor", "middle")
      .text((r) => INDEX_LABEL[r.index])
      .style("fill", "var(--text)").style("font-weight", 600).style("font-size", "14px");
    groups.append("text")
      .attr("x", x.bandwidth() / 2).attr("y", HEIGHT - M.bottom + 44)
      .attr("text-anchor", "middle")
      .text((r) => REGIME_LABEL[r.regime])
      .style("fill", (r) => (r.regime === "CAS" ? "var(--orchid)" : "var(--teal)"))
      .style("font-size", "13px");
  }, [rows, selected, width, onSelect]);

  return (
    <div ref={wrap}>
      <svg ref={svgRef} width={width} height={HEIGHT} className="block max-w-full" aria-label="Median late move, normal vs expiry days, by index and era" />
    </div>
  );
}
