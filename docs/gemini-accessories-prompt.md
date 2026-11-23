# Gemini prompt: 3D accessory pictures (same look as the part pictures)

The part pictures use "style 6" (`assets/parts-3d/style 6/README.md`): glossy white, black rubber, brushed metal and neon lime (#D3F53D), soft studio light, flat light-grey background so they can be cut out. Accessories get the same look. Three objects per image (each keeps a high resolution when cut), 5 images for 15 accessories.

Use the strongest image model, the largest size it offers, 3:1 wide ratio (or 16:9 if 3:1 is not offered). Run once with the LIGHT prompt. For the dark-mode versions, attach the light result and use the DARK prompt from `assets/parts-3d/style 6/README.md` unchanged.

If you can, attach one existing part picture from `assets/images/parts/` (for example `oil-ok.webp`) as a style reference and add this line at the start: "Match the style, materials, lighting and lime accents of the attached reference picture exactly."

## What goes in each image (left, middle, right)

| Image | Left | Middle | Right |
|---|---|---|---|
| A1 | Dash cam | Seat covers | Floor mats |
| A2 | Car speaker | Window tint film roll | Roof rack |
| A3 | Phone holder | Steering wheel cover | Sunshade |
| A4 | Parking sensors | Reverse camera | LED headlight bulbs |
| A5 | Spoiler | Car cover | Air freshener |

Also make one generic picture for the "Accessories" category itself: a gift-style box with a lime ribbon (add it as the middle object of an image with two other accessories, or alone with two empty spaces).

## Prompt (replace the three object names for each image)

```
Create one wide image with three separate 3D rendered car accessories in a row, left to right:
LEFT: [OBJECT 1]. MIDDLE: [OBJECT 2]. RIGHT: [OBJECT 3].

Style: a clean, modern 3D product render, sharp and high resolution. Materials only: glossy white paint or plastic, black rubber, glossy black trim, brushed light-grey metal, and neon lime (#D3F53D) as the only accent colour, on one small piece of each object (a button, a stitch line, a ribbon, a ring). No other colours.

Lighting: soft studio light from the top left, soft highlights and soft reflections on the objects themselves.

Layout: each object is large in its third of the image, all three at a similar size, with clear empty space around each. Nothing touches another object or the edge of the image. Each object is shown from a three-quarter angle that makes it easy to recognise.

So the objects can be cut out later:
- Background: one perfectly flat, uniform, solid light grey (#F5F7F5) over the whole image, edge to edge. No gradient, no vignette, no texture, no dividing lines.
- No shadows or reflections on the ground and no glow around the objects. The objects float on the flat colour.
- Every object has a clean, crisp, complete outer edge.
- No text, numbers, logos or brand names.

Output a single wide image at the highest resolution available.
```

## Saving

Save the results as `assets/parts-3d/accessories/A1.png` ... `A5.png` and send me the images. I cut them into one picture per accessory, make the three status colours the same way the parts have them, and wire them in. The generic box picture is the first one wired in.

## About "Other"

The new record flow now has an **Other** row at the end of every list (maintenance, services, accessories). Choose it, type a name, and the record is saved under that name: as a general repair for maintenance, as an accessory or other cost for the rest. So a missing item never blocks anyone.

Note: the database has one accessories cost type today, not a list of 15 items, so the accessories step 2 list shows that one type plus Other. The 15 pictures are for when we split accessories into separate items (a small database change). Tell me when you want that, and I will use the pictures.
