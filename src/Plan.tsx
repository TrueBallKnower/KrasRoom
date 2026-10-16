import { useEffect, useRef, useState } from "react";
import { magneticPlacement, type AlignmentGuide } from "./placement";
import { wallOutline } from "./spatial";
import { assetGet } from "./db";
import { useStore } from "./store";
import {
  uid,
  distance,
  area,
  segmentDistance,
  collides,
  calibrateAutomaticPlan,
  type Point,
} from "./model";
export type Tool =
  "select" | "wall" | "room" | "scale" | "measure" | "door" | "window";
export default function Plan({
  tool,
  snap,
  hide,
  showCollisions = true,
  onMessage,
}: {
  tool: Tool;
  snap: boolean;
  hide: boolean;
  showCollisions?: boolean;
  onMessage: (s: string) => void;
}) {
  const { project: p, selected, select, change } = useStore();
  const [points, setPoints] = useState<Point[]>([]),
    [hover, setHover] = useState<Point>(),
    [url, setUrl] = useState(""),
    [zoom, setZoom] = useState(1),
    [origin, setOrigin] = useState({ x: -1, y: -1 }),
    [drag, setDragState] = useState<{
      id: string;
      offset: Point;
      point: Point;
    } | null>(null);
  const latestDrag = useRef<typeof drag>(null);
  function setDrag(next: typeof drag) {
    latestDrag.current = next;
    setDragState(next);
  }
  const svg = useRef<SVGSVGElement>(null);
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<{
    distance: number;
    zoom: number;
    origin: Point;
    center: Point;
    inverse: DOMMatrix;
  } | null>(null);
  const touchTap = useRef<{ x: number; y: number } | null>(null);
  const [guides, setGuides] = useState<AlignmentGuide[]>([]);
  const dragStart = useRef<{
    x: number;
    y: number;
    sx: number;
    sy: number;
  } | null>(null);
  function cancelGesture() {
    touches.current.clear();
    pinch.current = null;
    touchTap.current = null;
    setDrag(null);
    dragStart.current = null;
    setGuides([]);
  }
  function fitPlan() {
    if (!p.walls.length) {
      setZoom(1);
      setOrigin({ x: -1, y: -1 });
      return;
    }
    const points = p.walls.flatMap((w) => [w.a, w.b]),
      xs = points.map((q) => q.x),
      ys = points.map((q) => q.y);
    const minX = Math.min(...xs),
      minY = Math.min(...ys);
    setOrigin({ x: minX - 1, y: minY - 1 });
    setZoom(
      Math.min(
        4,
        12 / (Math.max(...xs) - minX + 2),
        9 / (Math.max(...ys) - minY + 2),
      ),
    );
  }
  useEffect(() => {
    fitPlan();
    cancelGesture();
    setPoints([]);
  }, [p.id]);
  useEffect(() => {
    setPoints([]);
  }, [tool]);
  useEffect(() => {
    let u = "",
      active = true;
    setUrl("");
    if (p.plan)
      assetGet(p.plan.asset).then((b) => {
        if (b && active) {
          u = URL.createObjectURL(b);
          setUrl(u);
        }
      });
    return () => {
      active = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [p.plan?.asset]);
  function point(e: { clientX: number; clientY: number }) {
    const matrix = svg.current!.getScreenCTM()!.inverse();
    const v = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix);
    let out = { x: v.x, y: v.y };
    if (snap && tool !== "scale") {
      const endpoints = p.walls.flatMap((w) => [w.a, w.b]);
      const nearest = endpoints
        .filter((v) => distance(v, out) < 0.18 / zoom)
        .sort((a, b) => distance(a, out) - distance(b, out))[0];
      out = nearest
        ? { ...nearest }
        : {
            x: Math.round(out.x * 20) / 20,
            y: Math.round(out.y * 20) / 20,
          };
      if (!nearest && points.length && tool === "wall") {
        const a = points.at(-1)!;
        if (Math.abs(out.x - a.x) < 0.12) out.x = a.x;
        if (Math.abs(out.y - a.y) < 0.12) out.y = a.y;
      }
    }
    return out;
  }
  function click(q: Point) {
    if (tool === "select") {
      select(null);
      return;
    }
    if (tool === "door" || tool === "window") {
      const w = [...p.walls].sort(
        (a, b) => segmentDistance(q, a.a, a.b) - segmentDistance(q, b.a, b.b),
      )[0];
      if (!w || segmentDistance(q, w.a, w.b) > 0.3)
        return onMessage("Cliquez sur un mur pour y placer une ouverture.");
      const len = distance(w.a, w.b),
        width = tool === "door" ? 0.9 : 1.2;
      if (len < width) return onMessage("Ce mur est trop court.");
      const offset = Math.max(
        0,
        Math.min(
          len - width,
          ((q.x - w.a.x) * (w.b.x - w.a.x) + (q.y - w.a.y) * (w.b.y - w.a.y)) /
            len -
            width / 2,
        ),
      );
      if (
        w.openings.some(
          (o) => offset < o.offset + o.width && offset + width > o.offset,
        )
      )
        return onMessage("Cette ouverture chevauche une ouverture existante.");
      change((p) =>
        p.walls
          .find((v) => v.id === w.id)!
          .openings.push({
            id: uid(),
            kind: tool,
            offset,
            width,
            height: tool === "door" ? 2.1 : 1.2,
            sill: tool === "door" ? 0 : 0.9,
          }),
      );
      select(w.id);
      return;
    }
    if (tool === "room") {
      if (points.length >= 3 && distance(q, points[0]) < 0.25) {
        change((p) =>
          p.rooms.push({
            id: uid(),
            name: "Nouvelle pièce",
            points: points,
            color: "#ddcbb4",
          }),
        );
        setPoints([]);
      } else setPoints([...points, q]);
      return;
    }
    if (!points.length) {
      setPoints([q]);
      return;
    }
    const a = points[0],
      len = distance(a, q);
    if (len < 0.01) return;
    if (tool === "wall") {
      change((p) =>
        p.walls.push({
          id: uid(),
          a,
          b: q,
          thickness: 0.15,
          height: 2.6,
          color: "#e9e5de",
          openings: [],
        }),
      );
      setPoints([q]);
    } else if (tool === "scale") {
      if (!p.plan) return onMessage("Importez d’abord votre plan.");
      const input = prompt(
        "Distance réelle entre les deux points, en mètres :",
        "1",
      );
      if (input === null) {
        setPoints([]);
        return;
      }
      const real = Number(input.replace(",", "."));
      if (!Number.isFinite(real) || real <= 0)
        return onMessage("Saisissez une distance positive en mètres.");
      change((p) => {
        if (p.analysis) calibrateAutomaticPlan(p, real / len);
        else p.plan!.scale *= real / len;
      });
      setPoints([]);
      onMessage(
        "Échelle définie. Tracez les murs sur le plan ; les mesures sont en mètres.",
      );
    } else {
      onMessage("Distance mesurée : " + len.toFixed(3) + " m");
      setPoints([]);
    }
  }
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPoints([]);
        cancelGesture();
      }
    };
    window.addEventListener("keydown", cancel);
    window.addEventListener("blur", cancelGesture);
    return () => {
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("blur", cancelGesture);
    };
  }, []);
  const draft = drag ? p.items.find((i) => i.id === drag.id) : null;
  return (
    <div className="plan-wrap">
      <div className="plan-controls">
        <button onClick={() => setZoom(Math.max(0.3, zoom / 1.2))}>−</button>
        <span>{Math.round(zoom * 100)} %</span>
        <button onClick={() => setZoom(Math.min(4, zoom * 1.2))}>+</button>
        <button onClick={fitPlan}>Tout voir</button>
      </div>
      <svg
        ref={svg}
        className="plan-svg"
        onPointerDownCapture={(e) => {
          if (e.pointerType !== "touch") return;
          touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (touches.current.size !== 2) return;
          const [a, b] = [...touches.current.values()];
          const inverse = svg.current!.getScreenCTM()!.inverse();
          const center = new DOMPoint(
            (a.x + b.x) / 2,
            (a.y + b.y) / 2,
          ).matrixTransform(inverse);
          pinch.current = {
            distance: distance(a, b),
            zoom,
            origin,
            center,
            inverse,
          };
          touchTap.current = null;
          setDrag(null);
          dragStart.current = null;
          setGuides([]);
          svg.current!.setPointerCapture(e.pointerId);
          e.stopPropagation();
        }}
        onPointerMoveCapture={(e) => {
          if (e.pointerType !== "touch") return;
          if (touches.current.has(e.pointerId))
            touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (!pinch.current) return;
          e.stopPropagation();
          if (touches.current.size < 2) return;
          const [a, b] = [...touches.current.values()],
            start = pinch.current;
          const nextZoom = Math.max(
            0.3,
            Math.min(
              4,
              (start.zoom * distance(a, b)) / Math.max(1, start.distance),
            ),
          );
          const mid = new DOMPoint(
            (a.x + b.x) / 2,
            (a.y + b.y) / 2,
          ).matrixTransform(start.inverse);
          setZoom(nextZoom);
          setOrigin({
            x:
              start.center.x -
              ((mid.x - start.origin.x) * start.zoom) / nextZoom,
            y:
              start.center.y -
              ((mid.y - start.origin.y) * start.zoom) / nextZoom,
          });
        }}
        onPointerUpCapture={(e) => {
          touches.current.delete(e.pointerId);
          if (!pinch.current) return;
          e.stopPropagation();
          if (!touches.current.size) pinch.current = null;
        }}
        onPointerCancel={cancelGesture}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) return;
          e.stopPropagation();
          try {
            const raw = e.dataTransfer.getData("roomora-item");
            if (!raw) return;
            const i = JSON.parse(raw),
              q = point(e),
              id = uid();
            change((p) => p.items.push({ ...i, id, x: q.x, y: q.y }));
            select(id);
          } catch {
            onMessage("Meuble invalide.");
          }
        }}
        viewBox={`${origin.x} ${origin.y} ${12 / zoom} ${9 / zoom}`}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") {
            touchTap.current = { x: e.clientX, y: e.clientY };
            svg.current!.setPointerCapture(e.pointerId);
            return;
          }
          if (e.button === 1) {
            e.preventDefault();
            return;
          }
          if (
            e.target === e.currentTarget ||
            !(e.target as Element).closest("[data-item]")
          )
            click(point(e));
        }}
        onPointerMove={(e) => {
          const drag = latestDrag.current;
          const q = point(e);
          setHover(q);
          if (e.buttons === 4) {
            setOrigin((o) => ({
              x: o.x - (e.movementX * 0.015) / zoom,
              y: o.y - (e.movementY * 0.015) / zoom,
            }));
          }
          if (
            drag &&
            dragStart.current &&
            Math.hypot(
              e.clientX - dragStart.current.sx,
              e.clientY - dragStart.current.sy,
            ) >= 5
          ) {
            const i = p.items.find((i) => i.id === drag.id)!;
            const candidate = {
              ...i,
              x: q.x - drag.offset.x,
              y: q.y - drag.offset.y,
            };
            const placement = snap
              ? magneticPlacement(candidate, p)
              : { item: candidate, guides: [] };
            setDrag({
              ...drag,
              point: { x: placement.item.x, y: placement.item.y },
            });
            setGuides(placement.guides);
          }
        }}
        onPointerUp={(e) => {
          const drag = latestDrag.current;
          if (e.pointerType === "touch" && touchTap.current) {
            if (
              Math.hypot(
                e.clientX - touchTap.current.x,
                e.clientY - touchTap.current.y,
              ) < 8
            )
              click(point(e));
            touchTap.current = null;
          }
          if (
            drag &&
            dragStart.current &&
            (Math.abs(drag.point.x - dragStart.current.x) > 0.0001 ||
              Math.abs(drag.point.y - dragStart.current.y) > 0.0001)
          ) {
            change((p) => {
              const i = p.items.find((i) => i.id === drag.id);
              if (i) {
                i.x = drag.point.x;
                i.y = drag.point.y;
              }
            });
          }
          setDrag(null);
          dragStart.current = null;
          setGuides([]);
        }}
      >
        <defs>
          <pattern
            id="grid"
            width=".5"
            height=".5"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M .5 0 L 0 0 0 .5"
              fill="none"
              stroke="#dce2db"
              strokeWidth=".008"
            />
          </pattern>
        </defs>
        <rect
          x="-100"
          y="-100"
          width="200"
          height="200"
          fill="url(#grid)"
          style={{ pointerEvents: "none" }}
        />
        {p.plan && url && (
          <image
            href={url}
            x="0"
            y="0"
            width={p.plan.width * p.plan.scale}
            height={p.plan.height * p.plan.scale}
            opacity=".45"
            style={{ pointerEvents: "none" }}
          />
        )}
        {p.rooms.map((r) => (
          <g
            key={r.id}
            onPointerDown={(e) => {
              if (tool === "select") {
                e.stopPropagation();
                select(r.id);
              }
            }}
          >
            <polygon
              points={r.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={r.color}
              fillOpacity=".65"
              stroke={selected === r.id ? "#397565" : "none"}
              strokeWidth=".03"
            />
            <text
              x={r.points.reduce((s, p) => s + p.x, 0) / r.points.length}
              y={r.points.reduce((s, p) => s + p.y, 0) / r.points.length}
              textAnchor="middle"
              fontSize=".17"
              fill="#737b71"
            >
              {r.name} · {area(r.points).toFixed(1)} m²
            </text>
          </g>
        ))}
        {p.walls.map((w) => (
          <g
            key={w.id}
            onPointerDown={(e) => {
              if (tool === "select") {
                e.stopPropagation();
                select(w.id);
              }
            }}
          >
            <polygon
              points={wallOutline(w, p.walls)
                .map((q) => `${q.x},${q.y}`)
                .join(" ")}
              fill={selected === w.id ? "#397bea" : "#697068"}
            />
            <line
              x1={w.a.x}
              y1={w.a.y}
              x2={w.b.x}
              y2={w.b.y}
              stroke="transparent"
              strokeWidth={w.thickness}
              strokeLinecap="butt"
            />
            {w.openings.map((o) => {
              const len = distance(w.a, w.b),
                dx = (w.b.x - w.a.x) / len,
                dy = (w.b.y - w.a.y) / len;
              return (
                <line
                  key={o.id}
                  x1={w.a.x + dx * o.offset}
                  y1={w.a.y + dy * o.offset}
                  x2={w.a.x + dx * (o.offset + o.width)}
                  y2={w.a.y + dy * (o.offset + o.width)}
                  stroke={
                    o.detection && !o.detection.reviewed
                      ? "#d9aa62"
                      : o.kind === "door"
                        ? "#f4f5f0"
                        : "#88b3c2"
                  }
                  strokeWidth={w.thickness + 0.02}
                />
              );
            })}
            <text
              x={(w.a.x + w.b.x) / 2}
              y={(w.a.y + w.b.y) / 2 - 0.16}
              fontSize=".14"
              textAnchor="middle"
              fill="#747d73"
            >
              {distance(w.a, w.b).toFixed(2)} m
            </text>
          </g>
        ))}
        {!hide &&
          p.items.map((i) => {
            const pos = drag?.id === i.id ? drag.point : i;
            return (
              <g
                key={i.id}
                data-item="true"
                transform={`translate(${pos.x} ${pos.y}) rotate(${i.rotation})`}
                onPointerDown={(e) => {
                  if (tool !== "select" || e.button !== 0) return;
                  e.stopPropagation();
                  select(i.id);
                  const q = point(e);
                  dragStart.current = {
                    x: i.x,
                    y: i.y,
                    sx: e.clientX,
                    sy: e.clientY,
                  };
                  setDrag({
                    id: i.id,
                    offset: { x: q.x - i.x, y: q.y - i.y },
                    point: { x: i.x, y: i.y },
                  });
                  svg.current!.setPointerCapture(e.pointerId);
                }}
              >
                <rect
                  x={-i.width / 2}
                  y={-i.depth / 2}
                  width={i.width}
                  height={i.depth}
                  rx=".05"
                  fill={i.color}
                  stroke={
                    showCollisions && collides({ ...i, x: pos.x, y: pos.y }, p)
                      ? "#d86a54"
                      : selected === i.id
                        ? "#347461"
                        : "#a49686"
                  }
                  strokeWidth={selected === i.id ? 0.04 : 0.02}
                />
                <g
                  pointerEvents="none"
                  stroke="#ffffffaa"
                  strokeWidth=".025"
                  fill="#ffffff44"
                >
                  {i.kind === "bed" && (
                    <>
                      <rect
                        x={-i.width * 0.42}
                        y={-i.depth * 0.42}
                        width={i.width * 0.37}
                        height={i.depth * 0.2}
                        rx=".06"
                      />
                      <rect
                        x={i.width * 0.05}
                        y={-i.depth * 0.42}
                        width={i.width * 0.37}
                        height={i.depth * 0.2}
                        rx=".06"
                      />
                      <path
                        d={`M${-i.width / 2} ${-i.depth * 0.1}H${i.width / 2}`}
                      />
                    </>
                  )}
                  {i.kind === "sofa" && (
                    <>
                      <rect
                        x={-i.width * 0.47}
                        y={-i.depth * 0.35}
                        width={i.width * 0.12}
                        height={i.depth * 0.8}
                        rx=".04"
                      />
                      <rect
                        x={i.width * 0.35}
                        y={-i.depth * 0.35}
                        width={i.width * 0.12}
                        height={i.depth * 0.8}
                        rx=".04"
                      />
                      <path d={`M0 ${-i.depth * 0.2}V${i.depth * 0.42}`} />
                    </>
                  )}
                  {i.kind === "plant" && (
                    <circle
                      r={Math.min(i.width, i.depth) * 0.4}
                      fill="#75a678"
                    />
                  )}
                  {(i.kind === "table" || i.kind === "rug") && (
                    <rect
                      x={-i.width * 0.43}
                      y={-i.depth * 0.4}
                      width={i.width * 0.86}
                      height={i.depth * 0.8}
                      rx=".04"
                      fill="none"
                    />
                  )}
                </g>
                <line
                  x1={-i.width * 0.35}
                  x2={i.width * 0.35}
                  y1={-i.depth * 0.32}
                  y2={-i.depth * 0.32}
                  stroke="#ffffff88"
                  strokeWidth=".045"
                />
                <text
                  textAnchor="middle"
                  y=".04"
                  fontSize=".12"
                  fill="#3c443b"
                  style={{ pointerEvents: "none" }}
                >
                  {i.name}
                </text>
              </g>
            );
          })}
        {guides.map((g, k) => (
          <line
            key={"guide" + k}
            x1={g.a.x}
            y1={g.a.y}
            x2={g.b.x}
            y2={g.b.y}
            stroke="#397bea"
            strokeWidth=".02"
            strokeDasharray=".1 .06"
            pointerEvents="none"
          />
        ))}
        {points.length > 0 && (
          <>
            <polyline
              points={[...points, ...(hover ? [hover] : [])]
                .map((p) => `${p.x},${p.y}`)
                .join(" ")}
              fill="none"
              stroke="#367b66"
              strokeWidth=".025"
              strokeDasharray=".08 .04"
            />
            {points.map((v, i) => (
              <circle key={i} cx={v.x} cy={v.y} r=".06" fill="#367b66" />
            ))}
            {hover && (
              <text
                x={hover.x + 0.1}
                y={hover.y - 0.1}
                fontSize=".15"
                fill="#367b66"
              >
                {distance(points.at(-1)!, hover).toFixed(2)} m
              </text>
            )}
          </>
        )}
      </svg>
      <div className="canvas-hint">
        {tool === "wall"
          ? "Cliquez sur les extrémités des murs · Échap pour terminer"
          : tool === "room"
            ? "Dessinez le contour puis cliquez sur le premier point"
            : tool === "scale"
              ? "Cliquez sur deux points dont vous connaissez la distance"
              : tool === "measure"
                ? "Cliquez sur deux points pour mesurer"
                : tool === "door" || tool === "window"
                  ? "Cliquez sur un mur pour ajouter une ouverture"
                  : "Glissez les meubles · Molette centrale pour déplacer le plan"}
      </div>
      {draft && (
        <span className="drag-badge">
          {drag!.point.x.toFixed(2)} m · {drag!.point.y.toFixed(2)} m
        </span>
      )}
    </div>
  );
}
