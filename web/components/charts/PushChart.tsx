"use client";

// What the manipulator adds to the index, minute by minute, from 15:00 to 15:30.
import * as d3 from "d3";
import "d3-transition";
import { useEffect, useRef, useState } from "react";
import { MARK, MINUTES } from "@/lib/lab";

const HEIGHT = 300;
const M = { top: 24, right: 20, bottom: 36, left: 52 };

type Props = { lift: number[]; vwapMoved: number; auctionMoved: number };

export default function PushChart({ lift, vwapMoved, auctionMoved }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || width === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const top = Math.max(10, d3.max(lift) ?? 0, vwapMoved, auctionMoved) * 1.15;
    const x = d3.scaleLinear().domain([0, MINUTES]).range([M.left, width - M.right]);
    const y = d3.scaleLinear().domain([0, top]).range([HEIGHT - M.bottom, M.top]).nice();

    const yAxis = svg.append("g").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(width - M.left - M.right)).tickPadding(8));
    yAxis.select(".domain").remove();
    yAxis.selectAll("line").style("stroke", "var(--grid)");
    yAxis.selectAll("text").style("fill", "var(--muted)").style("font-size", "12px");

    const xAxis = svg.append("g").attr("transform", `translate(0,${HEIGHT - M.bottom})`)
      .call(
        d3.axisBottom(x).tickValues([0, 5, 10, 14, 20, 25, 30]).tickSizeOuter(0).tickPadding(8)
          .tickFormat((m) => `15:${String(m).padStart(2, "0")}`),
      );
    xAxis.selectAll(".domain, line").style("stroke", "var(--line)");
    xAxis.selectAll("text").style("fill", "var(--muted)").style("font-size", "12px");

    // the auction collects orders and ends at a random minute from 15:28 to 15:30
    svg.append("rect").attr("x", x(28)).attr("width", x(30) - x(28))
      .attr("y", M.top).attr("height", HEIGHT - M.top - M.bottom)
      .style("fill", "var(--orchid-wash)");

    // the 15:14 mark: everything the late-move metric measures is to its right
    svg.append("line").attr("x1", x(MARK)).attr("x2", x(MARK))
      .attr("y1", M.top - 8).attr("y2", HEIGHT - M.bottom)
      .style("stroke", "var(--text)").style("stroke-dasharray", "3 4").style("opacity", 0.7);
    svg.append("text").attr("x", x(MARK) + 6).attr("y", M.top - 6)
      .style("fill", "var(--muted)").style("font-size", "12px").text("15:14 mark");

    const area = d3.area<number>().x((_, i) => x(i)).y0(y(0)).y1((d) => y(d)).curve(d3.curveMonotoneX);
    const line = d3.line<number>().x((_, i) => x(i)).y((d) => y(d)).curve(d3.curveMonotoneX);
    svg.append("path").datum(lift).attr("d", area).style("fill", "var(--amber)").style("opacity", 0.18);
    svg.append("path").datum(lift).attr("d", line)
      .style("fill", "none").style("stroke", "var(--amber)").style("stroke-width", 2.5);

    // where each settlement lands
    const level = (value: number, colour: string, label: string, from: number, anchor: "start" | "end") => {
      svg.append("line").attr("x1", x(from)).attr("x2", x(MINUTES))
        .attr("y1", y(value)).attr("y2", y(value))
        .style("stroke", colour).style("stroke-width", 2).style("stroke-dasharray", "6 4");
      svg.append("text").attr("x", anchor === "start" ? x(from) + 4 : x(MINUTES) - 4).attr("y", y(value) - 6)
        .attr("text-anchor", anchor)
        .style("fill", colour).style("font-size", "12px").style("font-weight", "600").text(label);
    };
    level(vwapMoved, "var(--teal)", `VWAP settlement +${vwapMoved.toFixed(1)}`, 1, "start");
    level(auctionMoved, "var(--orchid)", `auction +${auctionMoved.toFixed(1)}`, 24, "end");
  }, [lift, vwapMoved, auctionMoved, width]);

  return (
    <div ref={wrap}>
      <svg
        ref={svgRef}
        width={width}
        height={HEIGHT}
        className="block"
        role="img"
        aria-label="Extra index level added by the manipulator from 15:00 to 15:30, with where each settlement lands"
      />
    </div>
  );
}
