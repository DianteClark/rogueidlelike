// Camera with one-finger pan, two-finger pinch zoom, and tap detection. Works with mouse too.
export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0; this.y = 0;      // world point at the top-left of the screen
    this.zoom = 1;               // CSS px per world px
    this.minZoom = 0.4; this.maxZoom = 2;
    this.bounds = null;          // { w, h } in world px
    this.vx = 0; this.vy = 0;    // fling velocity
    this.onTap = null;
    this.pointers = new Map();
    this.drag = null;
    this.bind();
  }

  get w() { return this.canvas.clientWidth; }
  get h() { return this.canvas.clientHeight; }

  screenToWorld(sx, sy) { return { x: this.x + sx / this.zoom, y: this.y + sy / this.zoom }; }

  centerOn(wx, wy) { this.x = wx - this.w / 2 / this.zoom; this.y = wy - this.h / 2 / this.zoom; this.clamp(); }

  zoomAt(sx, sy, z) {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, z));
    this.x = before.x - sx / this.zoom;
    this.y = before.y - sy / this.zoom;
    this.clamp();
  }

  clamp() {
    if (!this.bounds) return;
    const vw = this.w / this.zoom, vh = this.h / this.zoom;
    const padX = vw * 0.25, padY = vh * 0.25;
    const fit = (v, size, view, pad) => size + pad * 2 <= view
      ? (size - view) / 2
      : Math.max(-pad, Math.min(size - view + pad, v));
    this.x = fit(this.x, this.bounds.w, vw, padX);
    this.y = fit(this.y, this.bounds.h, vh, padY);
  }

  update(dt) {
    if (!this.drag && (Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1)) {
      this.x -= this.vx * dt / this.zoom; this.y -= this.vy * dt / this.zoom;
      const k = Math.pow(0.02, dt); this.vx *= k; this.vy *= k;
      this.clamp();
    }
  }

  bind() {
    const c = this.canvas;
    const pos = (e) => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, pos(e));
      this.vx = this.vy = 0;
      if (this.pointers.size === 1) {
        const p = pos(e);
        this.drag = { sx: p.x, sy: p.y, lx: p.x, ly: p.y, t: performance.now(), moved: false, lt: performance.now() };
      } else {
        this.drag && (this.drag.moved = true);
        this.pinch = this.pinchState();
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, pos(e));
      if (this.pointers.size >= 2 && this.pinch) {
        const now = this.pinchState();
        this.zoomAt(now.cx, now.cy, this.pinch.zoom * now.dist / this.pinch.dist);
        this.x -= (now.cx - this.pinch.cx) / this.zoom;
        this.y -= (now.cy - this.pinch.cy) / this.zoom;
        this.pinch = { ...now, zoom: this.zoom };
        this.clamp();
      } else if (this.drag) {
        const p = pos(e), d = this.drag;
        if (Math.hypot(p.x - d.sx, p.y - d.sy) > 8) d.moved = true;
        if (d.moved) {
          const t = performance.now(), dt = Math.max(1, t - d.lt) / 1000;
          this.x -= (p.x - d.lx) / this.zoom; this.y -= (p.y - d.ly) / this.zoom;
          this.vx = (p.x - d.lx) / dt; this.vy = (p.y - d.ly) / dt;
          d.lt = t; this.clamp();
        }
        d.lx = p.x; d.ly = p.y;
      }
    });
    const end = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0 && this.drag) {
        const d = this.drag;
        if (!d.moved && performance.now() - d.t < 450 && this.onTap) {
          const w = this.screenToWorld(d.sx, d.sy);
          this.onTap(w.x, w.y);
        }
        if (performance.now() - d.lt > 80) { this.vx = this.vy = 0; }
        this.drag = null;
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      this.zoomAt(p.x, p.y, this.zoom * Math.pow(1.0015, -e.deltaY));
    }, { passive: false });
    // stop iOS page zoom gestures
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), zoom: this.zoom };
  }
}
