import * as React from "react";

export function SonarGrid({
  children,
  className = "",
  spacing = 26,
  dotRadius = 1.4,
  baseOpacity = 0.28,
  color = "#a9a0ff",
  pingEvery = 2400,
  speed = 260,
  ringWidth = 90,
  amplitude = 2.2,
  interactive = true,
}) {
  const hostRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!host || !canvas || !ctx) return;

    let width = 1;
    let height = 1;
    let raf = 0;
    let timer = 0;
    let visible = true;
    let rings = [];
    let nextPing = performance.now() + pingEvery;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    };

    const addRing = (x, y, now) => {
      rings.push({ x, y, born: now });
      if (rings.length > 6) rings.shift();
    };

    const draw = (now) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;

      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const ox = (width - (cols - 1) * spacing) / 2;
      const oy = (height - (rows - 1) * spacing) / 2;
      const lifetime = (Math.hypot(width, height) + ringWidth) / speed;

      rings = rings.filter(r => (now - r.born) / 1000 < lifetime);
      const live = rings.map(r => {
        const age = (now - r.born) / 1000;
        return {
          ...r,
          radius: age * speed,
          fade: Math.max(0, 1 - age / lifetime),
        };
      });

      ctx.globalAlpha = baseOpacity;
      ctx.beginPath();

      const hot = [];
      for (let i = 0; i < cols; i++) {
        const x = ox + i * spacing;
        for (let j = 0; j < rows; j++) {
          const y = oy + j * spacing;
          let energy = 0;

          for (const r of live) {
            const distance = Math.abs(Math.hypot(x - r.x, y - r.y) - r.radius);
            if (distance < ringWidth) {
              const t = 1 - distance / ringWidth;
              energy = Math.max(energy, t * t * (3 - 2 * t) * r.fade);
            }
          }

          if (energy < 0.01) {
            ctx.moveTo(x + dotRadius, y);
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
          } else {
            hot.push([x, y, energy]);
          }
        }
      }
      ctx.fill();

      for (const [x, y, energy] of hot) {
        ctx.globalAlpha = baseOpacity + (1 - baseOpacity) * energy;
        ctx.beginPath();
        ctx.arc(x, y, dotRadius * (1 + amplitude * energy), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;

      if (reduced.matches) {
        rings = [];
        draw(now);
        return;
      }

      if (pingEvery > 0 && now >= nextPing) {
        addRing(width * (0.2 + Math.random() * 0.6),
                height * (0.2 + Math.random() * 0.6), now);
        nextPing = now + pingEvery;
      }

      draw(now);
      if (rings.length) raf = requestAnimationFrame(tick);
      else if (pingEvery > 0) {
        timer = window.setTimeout(() => {
          raf = requestAnimationFrame(tick);
        }, Math.max(16, nextPing - now));
      }
    };

    const wake = () => {
      if (!raf && visible && !document.hidden) {
        clearTimeout(timer);
        raf = requestAnimationFrame(tick);
      }
    };

    const onPointer = (e) => {
      if (!interactive || reduced.matches) return;
      const rect = host.getBoundingClientRect();
      addRing(e.clientX - rect.left, e.clientY - rect.top, performance.now());
      wake();
    };

    const observer = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });

    const onVisibility = () => {
      if (!document.hidden) wake();
    };

    resize();
    observer.observe(host);
    intersection.observe(host);
    host.addEventListener("pointerdown", onPointer);
    document.addEventListener("visibilitychange", onVisibility);
    if (!reduced.matches) {
      addRing(width * 0.68, height * 0.42, performance.now() - 500);
    }
    wake();

    return () => {
      observer.disconnect();
      intersection.disconnect();
      host.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [spacing, dotRadius, baseOpacity, color, pingEvery, speed, ringWidth, amplitude, interactive]);

  return (
    <div ref={hostRef} className={`sonar-grid ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="sonar-canvas" />
      {children}
    </div>
  );
}

export default SonarGrid;
