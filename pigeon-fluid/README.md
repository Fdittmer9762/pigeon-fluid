# Pigeon Fluid

Modern, self-contained WebGL2 fluid effect for a website. No Haxe, Neko, Lime, Flow, npm, or build step.

## Files
- `index.html` — page shell
- `style.css` — canvas/page styling
- `config.js` — **artist controls; edit this first**
- `fluid.js` — fluid engine
- `squarespace-embed.html` — iframe example

## Run it
The simplest test is to double-click `index.html`.

For a proper local web server, open a terminal in this folder and run:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## First variables to change
Open `config.js`.

- `SPLAT_RADIUS` — interaction brush size
- `FORCE` — cursor push strength
- `VELOCITY_DISSIPATION` — how long motion survives; closer to 1 = longer
- `DYE_DISSIPATION` — how long color survives; closer to 1 = longer
- `COLOR_SLOW`, `COLOR_FAST`, `HIGHLIGHT` — palette
- `SIM_RESOLUTION` — simulation detail / GPU cost
- `PRESSURE_ITERATIONS` — solver quality / GPU cost

## Suggested experiments
Fine ink:
```js
SPLAT_RADIUS: 0.008,
VELOCITY_DISSIPATION: 0.985,
```

Broad, floaty motion:
```js
SPLAT_RADIUS: 0.04,
VELOCITY_DISSIPATION: 0.998,
```

Lower-cost website background:
```js
SIM_RESOLUTION: 96,
PRESSURE_ITERATIONS: 12,
```

## Squarespace
Host this folder as a static site (GitHub Pages is fine), then paste the contents of `squarespace-embed.html` into a Squarespace Code Block and replace the URL with your hosted URL.

The iframe approach keeps the WebGL canvas isolated from Squarespace's own scripts.
