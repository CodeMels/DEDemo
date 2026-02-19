# From Process to Dashboard — P2P Pipeline Simulator

An interactive web app that walks process engineers through the data engineering pipeline behind a process mining dashboard.

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (opens at http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview the production build locally
npm run preview
```

## Deploy to Vercel (recommended)

1. Push this project to a GitHub/GitLab repository
2. Go to [vercel.com](https://vercel.com) and sign in with your Git provider
3. Click **"Add New Project"** and import your repository
4. Vercel auto-detects Vite — no configuration needed
5. Click **Deploy**

Your site will be live at `https://your-project-name.vercel.app`. Every push to `main` will auto-deploy.

## Deploy to Netlify

1. Push this project to a GitHub/GitLab repository
2. Go to [netlify.com](https://netlify.com) and sign in
3. Click **"Add new site" → "Import an existing project"**
4. Select your repository
5. Set build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Click **Deploy site**

### Alternative: drag & drop (no Git required)

```bash
npm install
npm run build
```

Then drag the `dist/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).

## Deploy to GitHub Pages

1. Install the plugin:
   ```bash
   npm install -D vite-plugin-static-copy gh-pages
   ```

2. Add to `package.json` scripts:
   ```json
   "deploy": "npm run build && npx gh-pages -d dist"
   ```

3. Add `base` to `vite.config.js`:
   ```js
   export default defineConfig({
     base: '/your-repo-name/',
     plugins: [react()],
   })
   ```

4. Run `npm run deploy`

## Project Structure

```
p2p-simulator/
├── index.html          ← HTML entry point
├── package.json        ← Dependencies & scripts
├── vite.config.js      ← Vite configuration
└── src/
    ├── main.jsx        ← React mount point
    └── App.jsx         ← The full simulator app
```
