"use client";

// Every day's late move on a timeline. Drag to pan, pinch or cmd + scroll to zoom.
import * as d3 from "d3";
import "d3-transition";
import { useEffect, useRef, useState } from "react";
import { AUCTION_START, days as allDays, formatBps, formatDay, type Day } from "@/lib/data";

const HEIGHT = 460;
const M = { top: 20, right: 20, bottom: 40, left: 64 };

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const keyOf = (d: Day) => `${d.index_name}|${d.day}`;
const colour = (d: Day) => (d.is_expiry ? "var(--amber)" : d.regime === "CAS" ? "var(--orchid)" : "var(--teal)");
const radius = (d: Day) => (d.is_expiry ? 5.5 : 3.5);
const tagDate = d3.utcFormat("%a %-d %b %Y");

type View = { x: d3.ScaleTime<number, number>; y: d3.ScaleLinear<number, number> };
type Props = { data: Day[]; selected: Day | null; focus: Day | null; onSelect: (d: Day) => void };

export default function Scatter({ data, selected, focus, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  const [tags, setTags] = useState<{ x: number; y: number; date: string; bps: number } | null>(null);
  const [hover, setHover] = useState<{ d: Day; x: number; y: number } | null>(null);

  const view = useRef<View | null>(null);
  const zoomer = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transform = useRef(d3.zoomIdentity);
  const chosen = useRef<Day | null>(selected);
  const placeRing = useRef<() => void>(() => {});
  const pick = useRef(onSelect);
  const focused = useRef(false);
  const played = useRef(false);

  useEffect(() => {
    pick.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    chosen.current = selected;
    placeRing.current();
  }, [selected]);

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
    setHover(null);

    const innerW = width - M.left - M.right;
    const [first, last] = d3.extent(allDays, (d) => parse(d.day)) as [Date, Date];
    const x0 = d3
      .scaleUtc()
      .domain([d3.utcDay.offset(first, -4), d3.utcDay.offset(last, 4)])
      .range([M.left, width - M.right]);
    const span = Math.max(5, d3.max(data, (d) => Math.abs(d.late_move_bps)) ?? 0);
    const y = d3.scaleLinear().domain([-span, span]).range([HEIGHT - M.bottom, M.top]).nice();

    svg.append("defs").append("clipPath").attr("id", "explorer-clip")
      .append("rect").attr("x", M.left).attr("y", M.top)
      .attr("width", innerW).attr("height", HEIGHT - M.top - M.bottom);

    const yAxis = svg.append("g").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(7).tickSize(-innerW).tickPadding(10));
    yAxis.select(".domain").remove();
    yAxis.selectAll("line").style("stroke", "var(--grid)");
    yAxis.selectAll("text").style("fill", "var(--muted)").style("font-size", "12px");
    svg.append("text").attr("x", M.left - 10).attr("y", M.top - 6).attr("text-anchor", "end")
      .style("fill", "var(--muted)").style("font-size", "11px").text("bps");

    const xAxis = svg.append("g").attr("transform", `translate(0,${HEIGHT - M.bottom})`);
    const plot = svg.append("g").attr("clip-path", "url(#explorer-clip)");
    const wash = plot.append("rect").attr("y", M.top).attr("height", HEIGHT - M.top - M.bottom)
      .style("fill", "var(--orchid-wash)");
    const cut = plot.append("line").attr("y1", M.top).attr("y2", HEIGHT - M.bottom)
      .style("stroke", "var(--orchid)").style("stroke-dasharray", "4 4");
    plot.append("line").attr("x1", M.left).attr("x2", width - M.right).attr("y1", y(0)).attr("y2", y(0))
      .style("stroke", "var(--muted)").style("opacity", 0.5);

    // expiries last so they sit on top
    const ordered = [...data].sort((a, b) => Number(a.is_expiry) - Number(b.is_expiry));
    const dots = plot.selectAll<SVGCircleElement, Day>("circle.day")
      .data(ordered, keyOf)
      .join("circle")
      .attr("class", "day")
      .attr("cy", (d) => y(d.late_move_bps))
      .attr("r", radius)
      .style("fill", colour)
      .style("fill-opacity", (d) => (d.is_expiry ? 0.95 : 0.55));

    const ring = plot.append("circle").attr("r", 11).attr("pointer-events", "none")
      .style("fill", "none").style("stroke", "var(--text)").style("stroke-width", 2).style("opacity", 0);

    placeRing.current = () => {
      const s = chosen.current;
      const v = view.current;
      const shown = s !== null && data.some((d) => keyOf(d) === keyOf(s));
      if (!s || !v || !shown) {
        ring.style("opacity", 0);
        return;
      }
      ring.attr("cx", v.x(parse(s.day))).attr("cy", v.y(s.late_move_bps)).style("opacity", 1);
    };

    const render = (t: d3.ZoomTransform) => {
      const x = t.rescaleX(x0);
      view.current = { x, y };
      xAxis.call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(innerW / 120))).tickSizeOuter(0).tickPadding(10));
      xAxis.selectAll(".domain, line").style("stroke", "var(--line)");
      xAxis.selectAll("text").style("fill", "var(--muted)").style("font-size", "12px");
      const a = x(parse(AUCTION_START));
      wash.attr("x", a).attr("width", Math.max(0, width - M.right - a));
      cut.attr("x1", a).attr("x2", a);
      dots.attr("cx", (d) => x(parse(d.day)));
      placeRing.current();
    };

    // plain scrolling still scrolls the page; pinch or cmd + scroll zooms
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 30])
      .extent([[M.left, 0], [width - M.right, HEIGHT]])
      .translateExtent([[M.left, 0], [width - M.right, HEIGHT]])
      .filter((e) => (e.type === "wheel" ? e.ctrlKey || e.metaKey : !e.button))
      .on("zoom", (e: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        transform.current = e.transform;
        render(e.transform);
        if (e.sourceEvent) setHover(null);
      });
    zoomer.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);
    svg.call(zoom.transform, transform.current);

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!played.current && !calm) {
      played.current = true;
      dots.attr("r", 0).transition().delay((_, i) => 200 + i * 1.5).duration(450).attr("r", radius);
    }

    dots
      .on("pointerenter", (e: PointerEvent, d) => {
        d3.select(e.currentTarget as SVGCircleElement).interrupt().attr("r", radius(d) + 3);
        const v = view.current;
        if (v) setHover({ d, x: v.x(parse(d.day)), y: y(d.late_move_bps) });
      })
      .on("pointerleave", (e: PointerEvent, d) => {
        d3.select(e.currentTarget as SVGCircleElement).attr("r", radius(d));
        setHover(null);
      })
      .on("click", (_, d) => pick.current(d));

    // TradingView style value tags on both axes
    svg
      .on("pointermove.tags", (e: PointerEvent) => {
        const v = view.current;
        const [mx, my] = d3.pointer(e);
        const inside = mx >= M.left && mx <= width - M.right && my >= M.top && my <= HEIGHT - M.bottom;
        if (!v || !inside) {
          setTags(null);
          return;
        }
        setTags({ x: mx, y: my, date: tagDate(v.x.invert(mx)), bps: y.invert(my) });
      })
      .on("pointerleave.tags", () => setTags(null));

    // arriving from another page with a day picked: glide in on it once
    if (focus && !focused.current) {
      focused.current = true;
      const cx = x0(parse(focus.day));
      const t = d3.zoomIdentity.translate((M.left + width - M.right) / 2, 0).scale(6).translate(-cx, 0);
      svg.transition().delay(400).duration(1000).call(zoom.transform, t);
    }
  }, [data, width, focus]);

  const zoomBy = (factor: number) => {
    if (!svgRef.current || !zoomer.current) return;
    zoomer.current.scaleBy(d3.select(svgRef.current).transition().duration(350), factor);
  };
  const reset = () => {
    if (!svgRef.current || !zoomer.current) return;
    zoomer.current.transform(d3.select(svgRef.current).transition().duration(500), d3.zoomIdentity);
  };

  const btn = "rounded-full border border-line bg-raised px-3 py-1 text-xs font-semibold text-text hover:border-text";
  const tag = "pointer-events-none absolute whitespace-nowrap rounded-md bg-text px-1.5 py-0.5 text-[11px] font-semibold text-bg";

  return (
    <div ref={wrap} className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={HEIGHT}
        className="block select-none"
        role="img"
        aria-label="Late move of every trading day, coloured by settlement era, with expiries in amber"
      />

      <div className="absolute right-6 top-1 flex gap-1">
        <button className={btn} onClick={() => zoomBy(1.8)} aria-label="Zoom in">+</button>
        <button className={btn} onClick={() => zoomBy(1 / 1.8)} aria-label="Zoom out">−</button>
        <button className={btn} onClick={reset}>Reset</button>
      </div>

      {tags && (
        <>
          <div className={tag} style={{ right: width - M.left + 4, top: tags.y - 10 }}>
            {tags.bps > 0 ? "+" : ""}
            {tags.bps.toFixed(1)}
          </div>
          <div className={tag} style={{ left: tags.x, top: HEIGHT - M.bottom + 6, transform: "translateX(-50%)" }}>
            {tags.date}
          </div>
        </>
      )}

      {hover && (
        <div
          className="pointer-events-none absolute w-52 rounded-2xl border border-line bg-raised p-3"
          style={{
            left: Math.min(Math.max(hover.x + 14, 0), width - 216),
            top: Math.max(hover.y - 76, 0),
            boxShadow: "var(--shadow)",
          }}
        >
          <p className="text-xs text-muted">{formatDay(hover.d.day)}</p>
          <p className="font-display text-xl font-bold" style={{ color: colour(hover.d) }}>
            {formatBps(hover.d.late_move_bps)}
          </p>
          <p className="text-xs text-muted">{hover.d.is_expiry ? "Expiry day" : "Normal day"}, click for detail</p>
        </div>
      )}
    </div>
  );
}
