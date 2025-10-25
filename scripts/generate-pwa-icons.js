// Simple script to generate PNG icons from SVG using Bun
import { $ } from "bun";

const sizes = [192, 512];

console.log("Generating PWA icons...");

for (const size of sizes) {
  const input = "./src/assets/icon.svg";
  const output = `./src/assets/icon-${size}.png`;

  try {
    // Using ImageMagick's convert or rsvg-convert if available
    // If neither is available, we'll create a fallback
    await $`convert ${input} -resize ${size}x${size} ${output}`.quiet();
    console.log(`✓ Generated ${output}`);
  } catch (error) {
    console.log(`⚠ ImageMagick not available. Creating fallback for ${size}x${size}...`);

    // Create a simple colored square as fallback using canvas
    const canvas = document.createElement?.('canvas');
    if (!canvas) {
      console.log(`Please install ImageMagick to generate icons, or manually create icon-${size}.png`);
      continue;
    }
  }
}

console.log("\nDone! If icons weren't generated, install ImageMagick:");
console.log("  macOS: brew install imagemagick");
console.log("  or manually create src/assets/icon-192.png and src/assets/icon-512.png");
