# PWA Icons

## Current Status

The PWA manifest requires icon files in PNG format. Currently, placeholder files exist:
- `icon-192.png.placeholder`
- `icon-512.png.placeholder`

An SVG template has been created at `icon.svg` that represents the QR Chain Attendance app with:
- Blue background (#0078d4)
- QR code pattern
- Chain link symbol

## Generating Icons

To generate the actual PNG icons from the SVG:

### Option 1: Using Online Tools
1. Open `icon.svg` in a browser or SVG editor
2. Export as PNG at 192x192 and 512x512 resolutions
3. Save as `icon-192.png` and `icon-512.png`

### Option 2: Using ImageMagick (if installed)
```bash
cd frontend/public
convert -background none -resize 192x192 icon.svg icon-192.png
convert -background none -resize 512x512 icon.svg icon-512.png
```

### Option 3: Using Node.js with sharp
```bash
npm install --save-dev sharp
node -e "const sharp = require('sharp'); sharp('icon.svg').resize(192, 192).toFile('icon-192.png'); sharp('icon.svg').resize(512, 512).toFile('icon-512.png');"
```

### Option 4: Using Inkscape (if installed)
```bash
inkscape icon.svg --export-filename=icon-192.png --export-width=192 --export-height=192
inkscape icon.svg --export-filename=icon-512.png --export-width=512 --export-height=512
```

## For Development

For development and testing purposes, you can create simple colored PNG files:

```bash
# Create simple placeholder PNGs (requires ImageMagick)
convert -size 192x192 xc:#0078d4 icon-192.png
convert -size 512x512 xc:#0078d4 icon-512.png
```

Or use the provided SVG directly in browsers that support it (most modern browsers).

## Icon Requirements

- **192x192**: Used for Android home screen and app drawer
- **512x512**: Used for splash screens and high-resolution displays
- **Format**: PNG with transparency support
- **Purpose**: "any maskable" - works on all platforms including Android adaptive icons
