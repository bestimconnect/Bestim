# Gemini prompt v2: 360° car grids (steady camera)

What went wrong in v1: the car changed size and position between cells, and the cells were small (6×4 in one image). v2 fixes this by (1) making two grids of 12 instead of one of 24, so each cell is about 2.5× larger, (2) fixing the car's size by its wheels and length, and (3) giving Gemini a reference image of the first grid so the second one matches.

Use the strongest image model (Gemini 3 Pro Image / "Nano Banana Pro"), **4K**, aspect ratio **16:9**. Attach `assets/images/vehicles/<type>.png` as the style reference. Replace `[SEDAN]`.

## Run 1: angles 0° to 165° (frames 00 to 11)

```
Create ONE image: a perfectly regular grid of 4 columns by 3 rows = 12 equal cells. Every cell shows the SAME car on an invisible turntable, photographed by a camera that never moves. 4K resolution, 16:9.

THE CAR
A [SEDAN] exactly like the attached reference: glossy white body, black glass and black trim, lime green (#D3F53D) accents (thin strip on the lower sill and bumpers, mirror caps, centre of the wheels). Same design and colors in every cell. No badges, no logos, no license plate text.

THE 12 FRAMES (reading order: left to right, then top to bottom)
The car turns clockwise as seen from above, 15 degrees per frame:
Row 1:   0°, 15°, 30°, 45°
Row 2:  60°, 75°, 90°, 105°
Row 3: 120°, 135°, 150°, 165°
0° = seen exactly from the front. 90° = pure driver's-side profile, nose pointing LEFT. 165° = almost the rear, a little past the driver's side.

THE CAMERA (identical in every cell, this is the most important rule)
- Orthographic-style long lens (about 135 mm look), almost no perspective distortion, camera at the height of the car's headlights, looking straight ahead (no tilt down).
- The camera, its distance, its zoom and the floor never change. Only the car turns.
- The car turns around the exact CENTRE of its body, and that centre is the exact centre of its cell in every cell.
- SIZE LOCK: the car is physically the same size in every cell. The front tyre diameter is 15% of the cell height in EVERY cell, the car body length is 80% of the cell width at 90°, and the tyres' bottom edge touches the same ground line, 80% down the cell, in EVERY cell. The ground line is a perfectly horizontal line at the same height in all 12 cells.
- Do NOT zoom in on the car at the front or rear views and do NOT zoom out at the profile. Do not re-frame per cell.

GRID LAYOUT (the image is cut by exact math)
- 12 identical cells, perfectly aligned, same size.
- NO borders, lines, gaps, labels, numbers, text, watermark.
- One flat, seamless, uniform very light grey background (#EEF1EF) across the whole image. No gradient, no vignette, no floor reflection. A small soft contact shadow directly under the car only, identical in every cell.
- Nothing may cross a cell edge. At least 6% empty margin on all sides in every cell.

LIGHT AND QUALITY
Soft even studio light from above and slightly in front, identical in every cell. Sharp photographic 3D-render quality, crisp panel lines, detailed wheels, lights, mirrors, wipers and grille. No motion blur, no blur anywhere.
```

## Run 2: angles 180° to 345° (frames 12 to 23)

Attach the Run 1 result (and the same style reference), and use the same prompt, with these two changes:

1. Replace the frame list with:
```
Row 1: 180°, 195°, 210°, 225°
Row 2: 240°, 255°, 270°, 285°
Row 3: 300°, 315°, 330°, 345°
180° = exactly from the rear. 270° = pure passenger's-side profile, nose pointing RIGHT. 345° = almost the front again.
```
2. Add at the end:
```
The attached image is the first half of the same turntable shoot. Match it exactly: same car, same size, same ground line, same cell proportions, same background color, same shadow, same light. A car at 90° in the attached image and a car at 270° in this image must have the same size and the same ground line.
```

## Tips
- If a grid is still uneven, regenerate that grid, not both. Pick the best of 3 tries; it is worth it, since these frames are used for every car of this body type.
- Save as PNG at full size, no editing: `assets/images/360/source/sedan-a.png` (Run 1) and `sedan-b.png` (Run 2).

## After you have the images
I cut and align them (positions only; sizes stay as drawn):

```
scripts/slice-grid.sh assets/images/360/source/sedan-a.png sedan-a 4 3
scripts/slice-grid.sh assets/images/360/source/sedan-b.png sedan-b 4 3
```
then I merge them into `assets/images/360/sedan/00 to 23` and run `swift scripts/align-frames.swift assets/images/360/sedan`.
