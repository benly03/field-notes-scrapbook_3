# Field Notes — a map scrapbook

A single-page site: a rotatable 3D globe ([globe.gl](https://globe.gl), built
on Three.js/WebGL) with red pins for places you've been. Click a pin and the
camera flies in, a side panel opens, and shows the photos for that stop. No
backend, no build step, no API key — plain HTML/CSS/JS, ready for GitHub Pages.

**Trade-off worth knowing:** the globe uses a static, fairly low-resolution
Earth texture (NASA Blue Marble), not live satellite tiles. It looks good
zoomed out; it will look soft/blurry if you zoom in past city level. If you
want sharp close-up satellite detail, a flat 2D map (Leaflet + Esri tiles) is
the better engine — this version was built for the 3D visual specifically.
Also: this pulls in Three.js, a meaningfully heavier download than a 2D map
library, so first load will be slower on a poor connection.

## Run it locally

Because the page fetches `data/locations.json` with `fetch()`, opening
`index.html` directly (`file://`) will fail in most browsers due to CORS
restrictions on local files. Serve it instead:

```bash
cd scrapbook
python3 -m http.server 8000
# then open http://localhost:8000
```

## Add a real location

1. Add photos to `images/<some-id>/` (compress them first — see note below).
2. Add an entry to `data/locations.json`:

```json
{
  "id": "unique-id",
  "name": "City, Country",
  "region": "Optional region label",
  "lat": 41.9028,
  "lng": 12.4964,
  "altitude": 0.4,
  "date": "2024-06-15",
  "note": "A short journal line about the trip.",
  "photos": [
    { "src": "images/unique-id/01.jpg", "caption": "Optional caption" }
  ]
}
```

`lat`/`lng` — get these by right-clicking the spot on Google Maps and
copying the coordinates, or by searching the place name in
[nominatim.openstreetmap.org](https://nominatim.openstreetmap.org/ui/search.html).

`altitude` — how close the camera flies in on click, in globe-radius units
(0 = touching the surface, 2.5 = the default zoomed-out view). Try 0.3–0.5
for a city-level view. Because the base texture is low-resolution, going
much closer than that just shows a blurrier version of the same image —
there's no more detail to reveal.

That's it — no rebuild needed, the site reads the JSON at page load.

## Deploy to GitHub Pages

1. Create a new repo on GitHub and push this folder's contents to it:
   ```bash
   git init
   git add .
   git commit -m "Initial scrapbook"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Source → Deploy from a branch → `main` / `root`**.
3. Your site will be live at `https://<your-username>.github.io/<repo-name>/`
   within a minute or two.

No API keys, no environment variables, nothing to configure.

## A real limitation worth knowing about

This repo stores photos as plain files in `/images`. That's fine for a
personal scrapbook of dozens of stops with web-sized images (compress to
~150–300KB each — full-res phone photos are 3–8MB and will make the repo
slow to clone and push). If you're picturing hundreds of locations with
many photos each, you'll want actual image hosting (e.g. Cloudinary,
Backblaze B2, or an S3 bucket) and just point `src` at those URLs instead
of a local path — the code doesn't care where the image lives.

## Swapping the globe texture

The globe image and bump map are set in `js/app.js` via `.globeImageUrl()`
and `.bumpImageUrl()`. Other free textures from the same source (no key
needed): `earth-night.jpg` (city lights, dramatic dark look), `earth-day.jpg`
(flatter, no relief shading), `earth-dark.jpg` (muted, low-contrast). Swap
the URL and refresh — no other code changes needed.

If you decide later that you want real satellite detail on click (not just
a nicer wide shot), that requires switching engines back to a 2D tile-based
map — the two approaches don't combine cleanly, since photographic
satellite tiles aren't available pre-rendered onto a rotatable sphere for
free.

## File structure

```
scrapbook/
├── index.html
├── css/style.css
├── js/app.js
├── data/locations.json     ← edit this to add/remove locations
├── data/countries.geojson  ← country border outlines (Natural Earth, public domain), ~480KB
├── images/<location-id>/   ← photos per location
└── README.md
```
