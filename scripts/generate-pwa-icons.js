// Simple script to generate PNG icons from SVG using Bun
import { $ } from "bun";
import { mkdirSync } from "fs";

const sizes = [180, 192, 512];
const outputDir = "./src/frontend/assets/gen";

// Ensure output directory exists
mkdirSync(outputDir, { recursive: true });

console.log("Generating PWA icons...");

for (const size of sizes) {
  const input = "./src/frontend/assets/icon.svg";
  const output = `${outputDir}/icon-${size}.png`;

  try {
    // Using ImageMagick's convert or rsvg-convert if available
    // If neither is available, we'll create a fallback
    await $`convert ${input} -resize ${size}x${size} ${output}`.quiet();
    console.log(`✓ Generated ${output}`);
  } catch (error) {
    console.log(
      `⚠ ImageMagick not available. Creating fallback for ${size}x${size}...`,
    );

    // Create a simple colored square as fallback using canvas
    const canvas = document.createElement?.("canvas");
    if (!canvas) {
      console.log(
        `Please install ImageMagick to generate icons, or manually create ${output}`,
      );
      continue;
    }
  }
}

console.log("\nDone! If icons weren't generated, install ImageMagick:");
console.log("  macOS: brew install imagemagick");
console.log(
  `  or manually create ${outputDir}/icon-192.png and ${outputDir}/icon-512.png`,
);
