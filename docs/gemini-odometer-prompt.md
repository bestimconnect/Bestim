# Gemini prompt: 3D odometer dial (update-odometer page)

The odometer page gets one 3D dial picture in the same style as the part pictures (style 6: glossy white, black rubber, brushed metal, neon lime). The app draws the needle and the digits on top, so the picture must have **no needle and no digits**.

## How to run
1. Open a new Gemini chat. Attach one approved part picture as a style reference (for example `assets/parts-3d/style 6/reference/ref-01.png`).
2. Paste the LIGHT prompt, ask for the largest size, and save the result as `light.png`.
3. Open a new chat, attach the light result, paste the DARK prompt, save as `dark.png`.
4. Send both. They are cut out with `assets/parts-3d/alphagrid.swift` and saved as `assets/images/odometer-{light,dark}.webp`.

## LIGHT prompt

```
I am attaching a picture of 3D rendered car parts. Use it ONLY as a style reference: same render quality, same materials, same lighting, same neon lime.

Create ONE new object: a car dashboard gauge dial (a round speedometer-style instrument), seen straight from the front, perfectly centred, as a sharp high-resolution 3D product render.

The dial:
- A thick glossy white outer bezel ring with soft highlights, and a thin brushed light-grey metal ring inside it.
- A deep glossy black face with a subtle curved glass reflection across the top left.
- Around the face, a 240 degree arc of fine tick marks: small ticks in light grey, and five longer ticks in neon lime (#D3F53D). The arc opens at the bottom.
- A small brushed-metal round hub in the exact centre, with nothing attached to it.
- NO needle, NO numbers, NO letters, NO logos, NO text anywhere. The face is empty apart from the tick marks and the hub (the app adds the needle and digits later).

Quality and framing:
- Clean modern 3D render: glossy white, black glass, brushed metal, neon lime (#D3F53D). No other colours.
- Soft studio lighting from the top left, with soft highlights and soft reflections on the object itself.
- Square image. The dial fills about 80% of the width, centred, with clear empty space around it. Nothing touches the edge.

So it can be cut out later:
- Background: one perfectly flat, uniform, solid light grey (#F5F7F5) over the whole image, edge to edge. No gradient, no vignette, no texture.
- No shadow and no reflection on the ground, and no glow around the dial. The dial floats on the flat colour.
- A clean, crisp, complete outer edge.

Output a single square image at the highest resolution available.
```

## DARK prompt

```
I am attaching the LIGHT MODE version of a 3D rendered car gauge dial that I already approved.

Create the DARK MODE version of this exact picture as a sharp, high-resolution 3D render: the same dial, from the same angle, same shape, same tick marks, same empty face (still NO needle, NO numbers, NO text), designed to sit on a very dark phone screen (almost black green, #0E1411). Do not add, remove or redesign anything.

What changes for dark mode:
- The black face must not disappear on a dark screen. Lift it to a dark graphite grey with a soft, clearly visible lighter rim along its edge so the whole outline stays readable.
- The white bezel becomes a slightly softer, cooler off-white so it does not glare. Keep it glossy.
- Brushed metal stays metal, a little brighter, with clear highlights.
- The neon lime ticks stay exactly #D3F53D and look slightly luminous.
- Lighting: soft studio light from the top left plus a gentle cool rim light from behind that outlines the dial.

So it can be cut out later:
- Background: one perfectly flat, uniform, solid mid grey (#8A938D) over the whole image, edge to edge. This grey is only a backdrop for cutting; do not make the background dark. No gradient, no vignette, no texture.
- No shadow, no reflection, no glow spilling onto the background.
- A clean, crisp, complete outer edge.

Output a single square image at the highest resolution available.
```

## Notes
- If Gemini adds a needle or numbers anyway, add this line and rerun: "The face must be completely empty: remove the needle and every number."
- Tick marks start at 7 o'clock and end at 5 o'clock (240 degrees). The app's needle is drawn for exactly that range, so do not let Gemini change the arc.
