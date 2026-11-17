#!/bin/bash
# Generate Tauri icons from SVG

set -e

ICON_DIR="gui/src-tauri/icons"
SVG_FILE="$ICON_DIR/icon.svg"

if [ ! -f "$SVG_FILE" ]; then
    echo "SVG file not found: $SVG_FILE"
    exit 1
fi

echo "Generating icons from $SVG_FILE..."

# Check for ImageMagick or rsvg-convert
if command -v magick &> /dev/null; then
    CONVERT="magick"
elif command -v convert &> /dev/null; then
    CONVERT="convert"
elif command -v rsvg-convert &> /dev/null; then
    CONVERT="rsvg-convert"
else
    echo "Error: ImageMagick (magick/convert) or rsvg-convert required"
    echo "Install: brew install imagemagick librsvg (macOS) or apt install imagemagick librsvg2-bin (Linux)"
    exit 1
fi

# Generate PNG icons
for size in 16 32 48 64 128 256 512 1024; do
    if [ "$CONVERT" = "rsvg-convert" ]; then
        rsvg-convert -w $size -h $size "$SVG_FILE" -o "$ICON_DIR/${size}x${size}.png"
    else
        $CONVERT "$SVG_FILE" -resize "${size}x${size}" "$ICON_DIR/${size}x${size}.png"
    fi
    echo "  Generated ${size}x${size}.png"
done

# Generate @2x icons for macOS
for size in 16 32 64 128 256; do
    if [ "$CONVERT" = "rsvg-convert" ]; then
        rsvg-convert -w $((size*2)) -h $((size*2)) "$SVG_FILE" -o "$ICON_DIR/${size}x${size}@2x.png"
    else
        $CONVERT "$SVG_FILE" -resize "${size*2}x${size*2}" "$ICON_DIR/${size}x${size}@2x.png"
    fi
    echo "  Generated ${size}x${size}@2x.png"
done

# Generate Windows ICO (multi-resolution)
if [ "$CONVERT" != "rsvg-convert" ]; then
    $CONVERT "$ICON_DIR/16x16.png" "$ICON_DIR/32x32.png" "$ICON_DIR/48x48.png" "$ICON_DIR/256x256.png" "$ICON_DIR/icon.ico"
    echo "  Generated icon.ico"
fi

# Generate macOS ICNS (requires iconutil on macOS)
if [[ "$OSTYPE" == "darwin"* ]] && command -v iconutil &> /dev/null; then
    ICONSET_DIR="$ICON_DIR/icon.iconset"
    mkdir -p "$ICONSET_DIR"

    # Copy required sizes
    cp "$ICON_DIR/16x16.png" "$ICONSET_DIR/icon_16x16.png"
    cp "$ICON_DIR/16x16@2x.png" "$ICONSET_DIR/icon_16x16@2x.png"
    cp "$ICON_DIR/32x32.png" "$ICONSET_DIR/icon_32x32.png"
    cp "$ICON_DIR/32x32@2x.png" "$ICONSET_DIR/icon_32x32@2x.png"
    cp "$ICON_DIR/128x128.png" "$ICONSET_DIR/icon_128x128.png"
    cp "$ICON_DIR/128x128@2x.png" "$ICONSET_DIR/icon_128x128@2x.png"
    cp "$ICON_DIR/256x256.png" "$ICONSET_DIR/icon_256x256.png"
    cp "$ICON_DIR/256x256@2x.png" "$ICONSET_DIR/icon_256x256@2x.png"
    cp "$ICON_DIR/512x512.png" "$ICONSET_DIR/icon_512x512.png"
    cp "$ICON_DIR/512x512@2x.png" "$ICONSET_DIR/icon_512x512@2x.png"

    iconutil -c icns "$ICONSET_DIR" -o "$ICON_DIR/icon.icns"
    echo "  Generated icon.icns"
    rm -rf "$ICONSET_DIR"
fi

echo "Done! Icons generated in $ICON_DIR"