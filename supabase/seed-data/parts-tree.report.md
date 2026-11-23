# Parts tree extraction report

Source: `docs/ahmed-reports-2026-11-17/Bestim-Parts-Tree-Egyptian-Arabic.pdf` (74 pages). Output: `parts-tree.json`.

## Counts (found vs stated on page 1)
| Level | Stated | Found |
|---|---|---|
| Systems | 16 | 16 |
| Sub-systems | 127 | 127 |
| Groups | 444 | 444 |
| Parts | 2,047 | 2,047 |

No gap. Each page repeats the system header, and a sub-system or group that runs over a page break is repeated at the top of the next page. Those repeats were merged (not counted twice): 27 groups marked "(continued)" / "(تابع)" were folded into the group on the previous page. Page 74 is a references page (sources of the Egyptian part names), not part of the tree, so it was skipped.

## Legend (page 1)
- `*` before an Arabic part name: "description that needs checking against the catalog, depending on the car design". Stored as flag `check_catalog` (75 parts, no groups). The `*` is removed from the Arabic text.
- Page 1 does not explain the grey bracket tags, but they appear on English names: `[Diesel]`, `[EV]`, `[Hybrid]` and combinations such as `[Diesel · EV]`. They are stored as flags `diesel`, `ev`, `hybrid` (a combined tag gives several flags) and removed from the English name. Flag totals: diesel 283, check_catalog 75, ev 60, hybrid 36 (parts and groups together; 33 groups carry fuel flags). Meaning is read from the tag itself (the part or group applies to that fuel/drive type); the PDF gives no further definition.
- Other small grey notes such as `(front, rear)`, `(no.1)`, `(intake, exhaust)` are part of the name and were kept in `en`.
- Each sub-system also has `code` (for example `01-03`) as printed in the PDF. Groups have `flags` too (empty list when none).
- There is no separate fuel-type column and no sort column. English part names are links to a RockAuto catalog page (not extracted).

## How it was extracted
Read the PDF drawing instructions directly (glyph positions and font maps), not the plain text dump, so Arabic is in correct reading order with ligatures (لا etc.) normalised, diacritics (ّ ِ ُ) attached to the right letter, and Latin/digits inside Arabic (VVT, 12, OBD) kept in order. Row boundaries come from the table row backgrounds; English and Arabic cells split at the centre line. Nothing was translated or invented; no Arabic name is empty (0 rows with `"ar": ""`).

## Pages spot-checked against the rendered page image
1, 3, 8, 12, 25, 36, 44, 52, 60, 70 (10 pages: every row compared on 12, 25, 36, 44, 52, 60, 70; headings, flags, parentheses, diacritics and Latin-in-Arabic checked). System names also match the page 1 contents table. No differences found.

## Rows to be aware of (not errors found, lower certainty)
- About 80 Arabic names contain Latin letters or digits (for example `(VVT)`, `(OBD)`, `(PCV)`, `NOx`, `EGR`, `CVT`, `12`). Order was checked on pages 25 and 36 and looked correct; other rows were not individually compared with the image.
- Pages 2 to 7, 9 to 11, 13 to 24, 26 to 35, 37 to 43, 45 to 51, 53 to 59, 61 to 69, 71 to 73 were not compared row by row. The extraction is mechanical and the counts match exactly, so errors are unlikely, but a typo in a single Arabic word elsewhere would not have been caught.
- Four English names wrap onto two lines in the PDF (tag on the second line); they were joined and the tag turned into a flag.
