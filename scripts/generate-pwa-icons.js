#!/usr/bin/env bun

/**
 * PWA Icon Generator
 *
 * Generates PWA icons in multiple sizes from the source SVG icon.
 * Outputs icons to both src/frontend/assets/ and src/frontend/assets/gen/
 *
 * Usage: bun scripts/generate-pwa-icons.js
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_ICON = 'src/frontend/assets/icon.svg';
const OUTPUT_DIR = 'src/frontend/assets';
const GEN_DIR = 'src/frontend/assets/gen';

// Icon sizes to generate
const SIZES = [
	{ size: 180, name: 'icon-180.png' }, // Apple touch icon
	{ size: 192, name: 'icon-192.png' }, // PWA standard
	{ size: 512, name: 'icon-512.png' }, // PWA large
];

async function generateIcon(inputPath, outputPath, size) {
	console.log(`Generating ${size}x${size} icon: ${outputPath}`);

	// Use ImageMagick to convert SVG to PNG
	const proc = Bun.spawn(
		['convert', '-background', 'none', '-resize', `${size}x${size}`, inputPath, outputPath],
		{
			stdout: 'pipe',
			stderr: 'pipe',
		},
	);

	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`Failed to generate ${outputPath}: ${stderr}`);
	}
}

async function main() {
	console.log('🎨 PWA Icon Generator\n');

	// Check if source icon exists
	if (!existsSync(SOURCE_ICON)) {
		console.error(`❌ Source icon not found: ${SOURCE_ICON}`);
		console.error('Please create an icon.svg file first.');
		process.exit(1);
	}

	// Check if ImageMagick is installed
	const checkProc = Bun.spawn(['which', 'convert'], {
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const checkExitCode = await checkProc.exited;

	if (checkExitCode !== 0) {
		console.error('❌ ImageMagick not found!');
		console.error('Please install ImageMagick:');
		console.error('  macOS: brew install imagemagick');
		console.error('  Ubuntu: sudo apt-get install imagemagick');
		process.exit(1);
	}

	// Create output directories if they don't exist
	if (!existsSync(OUTPUT_DIR)) {
		mkdirSync(OUTPUT_DIR, { recursive: true });
	}
	if (!existsSync(GEN_DIR)) {
		mkdirSync(GEN_DIR, { recursive: true });
	}

	console.log(`📂 Source: ${SOURCE_ICON}`);
	console.log(`📂 Output: ${OUTPUT_DIR}\n`);

	// Generate icons
	try {
		for (const { size, name } of SIZES) {
			// Generate to main assets directory
			const mainOutput = join(OUTPUT_DIR, name);
			await generateIcon(SOURCE_ICON, mainOutput, size);

			// Also generate to gen directory
			const genOutput = join(GEN_DIR, name);
			await generateIcon(SOURCE_ICON, genOutput, size);
		}

		console.log('\n✅ All icons generated successfully!');
		console.log('\nGenerated files:');
		for (const { name } of SIZES) {
			console.log(`  - ${OUTPUT_DIR}/${name}`);
			console.log(`  - ${GEN_DIR}/${name}`);
		}
	} catch (error) {
		console.error('\n❌ Error generating icons:', error);
		process.exit(1);
	}
}

main();
