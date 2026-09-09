# images/

The UV99+1 page (`uv99-plus-one.html`) currently builds its hero composition —
the energy sphere, glass panes, podium and product box — entirely in CSS/SVG, so
it needs **no image files to render correctly**.

Drop real photography here when you have it and swap it in:

| Element | Suggested asset | Where to wire it |
|---|---|---|
| Hero product | `product-uv99-plus-one.webp` (transparent PNG/WebP of the carton or a filmed pane of glass) | replace `.upo-product__box` markup with `<img>` in `uv99-plus-one.html`, or set it as `background-image` on `.upo-product__face` in `style.css` |
| Hero backdrop | `hero-car.webp` (premium car, 3/4 rear, dark studio, visible film + reflections) | add an `<img>` inside `.upo-stage` behind `.upo-orbit`, `object-fit: cover` |
| Film strip left | `film-macro.webp` (nano-ceramic film surface, blue rim light) | `background-image` on `.upo-strip__panel--film` |
| Film strip right | `glass-edge.webp` (optical-grade glass edge, teal rim) | `background-image` on `.upo-strip__panel--edge` |

Keep images optimised: WebP/AVIF, < 300 KB each, 2000 px on the long edge max.
The layout already reserves the correct aspect boxes, so swapping in a real image
is a one-line change and will not shift anything.
