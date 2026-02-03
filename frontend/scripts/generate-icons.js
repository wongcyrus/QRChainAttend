#!/usr/bin/env node
/**
 * Generate PWA icons from SVG source
 * Requires: sharp package
 */

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  try {
    const sharp = require('sharp');
    const svgPath = path.join(__dirname, '../public/icon.svg');
    const publicDir = path.join(__dirname, '../public');

    console.log('Generating PWA icons from SVG...');

    // Generate 192x192 icon
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'icon-192.png'));
    console.log('✓ Generated icon-192.png');

    // Generate 512x512 icon
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon-512.png'));
    console.log('✓ Generated icon-512.png');

    console.log('✓ All icons generated successfully!');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('Error: sharp package not found. Install it with: npm install --save-dev sharp');
      process.exit(1);
    }
    throw error;
  }
}

generateIcons().catch(console.error);
