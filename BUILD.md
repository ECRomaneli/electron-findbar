### Build

Build the project for production (minified):

```sh
npm run build
```

Build in development mode:

```sh
npm run build:dev
```

### Project Structure

- **src/main.ts** - Main process entry point
- **src/preload.ts** - Preload script for context isolation
- **src/remote.ts** - Remote IPC module for renderer communication
- **src/app.ts** - UI/Renderer entry point
- **src/index.html** - Findbar UI template
- **src/app.css** - Findbar styles

The Webpack configuration produces 4 separate bundles:
1. `dist/main.js` - Main process (minified)
2. `dist/preload.js` - Preload script (minified)
3. `dist/remote.js` - Remote module (minified)
4. `dist/app.js` + `dist/index.html` + `dist/app.css` - Renderer UI (minified)