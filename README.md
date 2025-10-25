# bun-react-tailwind-shadcn-template

To install dependencies:

```bash
bun install
```

## Available Scripts

### Development

```bash
bun dev
```

Starts a development server with hot module reloading.

### Production

```bash
bun start
```

Runs the application in production mode.

```bash
bun run build
```

Builds the application for production to the `dist` folder. Uses `scripts/build.ts`.

### Asset Generation

```bash
bun run generate:icons
```

Generates PWA icon files from `src/assets/icon.svg`. Creates PNG files at various sizes (192x192, 512x512) using ImageMagick. Uses `scripts/generate-pwa-icons.js`.

**Note:** Requires ImageMagick to be installed:
```bash
brew install imagemagick
```

This project was created using `bun init` in bun v1.2.22. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
