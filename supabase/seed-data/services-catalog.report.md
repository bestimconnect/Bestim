# services-catalog.json build report
Source: Bug report PDF section 2 (2.3 to 2.12). Parsed from PDFKit text dump (Arabic was already in logical order; only NFKC and bracket fixes were needed). Pages 44 rendered to PNG to confirm the column layout.

Counts: 31 specialists (28 with jobs + Dealer, Self/DIY, Other with none), 45 categories, 225 job rows, 513 suggested-item rows (jobs/items repeat across specialists by design), 26 tracked jobs (have a km and/or month interval), 24 systems, 8 line-item types, 29 quick-add consumables, 30 alias groups.
Job counts per specialist match the "(N jobs)" figures in 2.4 for all 28.

Ambiguities / decisions
- Item type: PDF gives only P / C / S. Mapped to part / consumable / service. Finer types (machine_shop, diagnostic, towing, tip) are NOT assigned; the seeder or you decide.
- Intervals: intervalKm = lowest figure, intervalKmMax = upper end of a range; intervalMonths from "years"/"months" text (years x 12). Verbatim text in intervalText. Non-numeric intervals ("Per manufacturer schedule", "Older cars", "When noisy", "Licence renewal") give tracked=false. Engine oil: intervalKm 5000, max 10000, months 6 (7,500 semi-synthetic only in text).
- "Every 2 sets of pads or below min thickness" (front discs) and similar give no number, so untracked.
- fuel is null everywhere: the PDF has no diesel/hybrid/EV hints.
- Item aliases: attached only when an item/job Arabic name exactly equals an alias-group member; the full groups are in "aliasGroups" (English term + Arabic spellings).
- CNG specialist: its category heading is "الغاز الطبيعي / CNG" (no caps style); handled.
- Arabic brackets: PDF extraction mirrors them; swapped back to logical order. English brackets re-balanced.
- Dealer/DIY/Other Arabic names taken from 2.4 table (Dealer "توكيل / مركز خدمة معتمد", DIY "أنا بنفسي", Other "أخرى").

Arabic not fully recovered
- Quick-add consumable "Penetrating oil / rust remover spray (WD-40)": the line is garbled in the dump ("...)40-... (WD"). Set Arabic to "سبراي فك صدأ" and kept WD-40 in English; verify on page 53.
- Latin acronyms inside Arabic names (ABS, ECU, MAF, TPS, الهيدروليك والـABS) were reattached from trailing tokens; looks right, worth a glance at pages 39 and 44-45.
