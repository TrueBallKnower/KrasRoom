import { useEffect, useRef, useState } from "react";
import { colorPalette, hexToHsv, hsvToHex } from "./color";
export default function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value),
    [invalid, setInvalid] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    current = useRef(value),
    active = useRef(false);
  const hsv = hexToHsv(/^#[0-9a-f]{6}$/i.test(draft) ? draft : value);
  useEffect(() => {
    setDraft(value);
    current.current = value;
  }, [value]);
  useEffect(() => {
    const c = canvas.current?.getContext("2d");
    if (!c) return;
    const image = c.createImageData(180, 180);
    for (let y = 0; y < 180; y++)
      for (let x = 0; x < 180; x++) {
        const dx = (x - 90) / 88,
          dy = (y - 90) / 88,
          s = Math.hypot(dx, dy),
          i = (y * 180 + x) * 4;
        if (s > 1) continue;
        const hex = hsvToHex(
          ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360,
          s,
          hsv.v,
        );
        image.data[i] = parseInt(hex.slice(1, 3), 16);
        image.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        image.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        image.data[i + 3] = 255;
      }
    c.putImageData(image, 0, 0);
  }, [hsv.v, open]);
  function preview(hex: string) {
    current.current = hex;
    setDraft(hex);
    setInvalid(false);
  }
  function wheel(e: React.PointerEvent<HTMLCanvasElement>) {
    const b = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - b.left) / b.width) * 180 - 90,
      y = ((e.clientY - b.top) / b.height) * 180 - 90;
    preview(
      hsvToHex(
        ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
        Math.min(1, Math.hypot(x, y) / 88),
        hsv.v || 1,
      ),
    );
  }
  return (
    <div className="color-editor">
      <label className="field">
        {label}
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <div className="color-palette">
        {colorPalette.map(([name, color]) => (
          <button
            key={color}
            style={{ background: color }}
            title={name}
            aria-label={name}
            aria-pressed={value.toLowerCase() === color}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
      <details onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>Couleur personnalisée · roue chromatique</summary>
        {open && (
          <div className="color-wheel">
            <canvas
              ref={canvas}
              width={180}
              height={180}
              aria-label={`Roue chromatique · ${label}`}
              style={{ touchAction: "none" }}
              onPointerDown={(e) => {
                active.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                wheel(e);
              }}
              onPointerMove={(e) => {
                if (active.current) wheel(e);
              }}
              onPointerUp={(e) => {
                if (!active.current) return;
                active.current = false;
                e.currentTarget.releasePointerCapture(e.pointerId);
                onChange(current.current);
              }}
              onPointerCancel={() => {
                active.current = false;
                preview(value);
              }}
            />
            <span
              className="color-wheel-marker"
              style={{
                left: 90 + 88 * hsv.s * Math.cos((hsv.h * Math.PI) / 180),
                top: 90 + 88 * hsv.s * Math.sin((hsv.h * Math.PI) / 180),
                background: /^#[0-9a-f]{6}$/i.test(draft) ? draft : value,
              }}
            />
          </div>
        )}
        <label className="field">
          Luminosité
          <input
            type="range"
            min="1"
            max="100"
            value={Math.round(hsv.v * 100)}
            onChange={(e) =>
              preview(hsvToHex(hsv.h, hsv.s, Number(e.target.value) / 100))
            }
            onPointerUp={() => onChange(current.current)}
            onKeyUp={() => onChange(current.current)}
          />
        </label>
        <label className="field">
          Code couleur HEX
          <input
            aria-label={`Code HEX · ${label}`}
            value={draft}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (/^#[0-9a-f]{6}$/i.test(draft)) {
                onChange(draft);
                setInvalid(false);
              } else setInvalid(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-invalid={invalid}
          />
        </label>
        {invalid && <p role="alert">Saisissez un code comme #A4B09A.</p>}
      </details>
    </div>
  );
}
