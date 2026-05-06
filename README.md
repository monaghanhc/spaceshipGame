# spaceshipGame

Falling-objects space survival game (original Processing `.pde` sources in the repo root).

## Play on the web (GitHub Pages)

The browser build lives in the **`docs/`** folder (p5.js): `docs/index.html`, `docs/sketch.js`, and `docs/alienShip.png`.

### Enable GitHub Pages

**Option A — GitHub Actions (recommended; workflow included)**

1. Push this repository to GitHub (including `.github/workflows/deploy-pages.yml`).
2. **Settings → Pages** → **Build and deployment** → **Source**: **GitHub Actions**.
3. Push to **`main`** or **`master`** (or edit the workflow branches). The **Deploy GitHub Pages** workflow uploads the **`docs/`** folder.

**Option B — Deploy from a branch**

1. Push this repository to GitHub.
2. **Settings → Pages** → **Source**: **Deploy from a branch**.
3. Branch **`main`** (or default), folder **`/docs`**, save.

Your game will be available at:

`https://<your-username>.github.io/spaceshipGame/`

(Replace `<your-username>` and the repo name if yours differ.)

### Run locally

Serve the `docs` folder (recommended so assets load correctly with relative paths):

```bash
npx --yes serve docs
```

Then open the URL it prints (often `http://localhost:3000`).
