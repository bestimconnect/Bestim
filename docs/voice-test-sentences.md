# Voice test: sentences to record

We are comparing two AI services on real voices, to pick the one that understands Egyptian speech best and answers fastest.

**How to do it:** open the voice memo app on your phone, record one sentence per recording, speak the way you normally would, name each recording with its number (01, 02, …), and send the files to Shady.

**الطريقة:** افتح تطبيق التسجيل الصوتي على موبايلك، سجّل كل جملة في تسجيل لوحدها بطريقتك العادية في الكلام، سمّي كل تسجيل برقمه (01، 02، …)، وابعت الملفات لشادي.

Do not worry about saying a sentence perfectly: a natural voice, some background noise, a small change of words are all useful. If both of you record, each sends their own full set separately; Shady tests one set at a time.

| File | Say this |
|---|---|
| `01.m4a` | غيرت الزيت عند 125 ألف ودفعت 1200 جنيه |
| `02.m4a` | حطيت بنزين بـ 900 |
| `03.m4a` | غسلت العربية بـ 300 |
| `04.m4a` | دفعت 250 جنيه باركينج |
| `05.m4a` | دفعت 1200 في البطارية |
| `06.m4a` | العربية عاملة 82 ألف |
| `07.m4a` | غيرت الزيت وفلتر الزيت على 98 ألف بـ 1500 |
| `08.m4a` | غيرت تيل الفرامل امبارح بـ 2500 |
| `09.m4a` | غيرت الـ brake pads النهارده بـ 2500 |
| `10.m4a` | I changed زيت الموتور at 82000 km and paid 1800 جنيه |
| `11.m4a` | دفعت 1000 على العربية |
| `12.m4a` | غيرت الزيت والفلتر عند محمد في الحرفيين، وكان في صوت بسيط في الموتور وقال لي أرجعله بعد أسبوع |
| `13.m4a` | العربية عاملة 82 ألف وغيرت الزيت النهارده بـ 1600 جنيه |
| `14.m4a` | جددت الترخيص بألفين وتلتمية جنيه |
| `15.m4a` | دفعت تأمين العربية 4500 |
| `16.m4a` | غيرت الكاوتش الأربعة بـ 12 ألف جنيه |
| `17.m4a` | غيرت البطارية بـ 4000، والجاية بعد سنتين |
| `18.m4a` | دفعت 40 جنيه كارتة على الطريق الصحراوي |
| `19.m4a` | ركنت في الجراج بـ 30 جنيه |
| `20.m4a` | فولت بنزين بخمسمية جنيه والعداد 90 ألف |
| `21.m4a` | اشتريت مساحات جديدة بـ 250 بس لسه ما ركبتهاش |
| `22.m4a` | غيرت البوجيهات وفلتر الهوا بألف وتمنمية |
| `23.m4a` | صلحت التكييف بـ 900 جنيه |
| `24.m4a` | العداد دلوقتي 134 ألف وخمسمية |
| `25.m4a` | I filled up the tank for 600 and paid 50 for parking |
| `26.m4a` | Changed the brake pads yesterday for 850 pounds at 124,200 kilometers |
| `27.m4a` | Current mileage is 82,000 kilometers |
| `28.m4a` | غيرت الزيت موبيل 10 آلاف عند 110 ألف بـ 1400 |
| `29.m4a` | دفعت 200 غسيل و50 ركنة |
| `30.m4a` | الجو حلو النهارده |

Sentence 30 is on purpose: it has nothing to do with the car, and the app should record nothing.

---

**For Shady:** drop the files into `bestim-app/scripts/voice-eval/` (never committed) and run the command at the top of `scripts/voice-eval.ts`. The file's ending does not have to be `.m4a`: `.wav` and `.mp3` work too, matched by the number. What each sentence should produce is in `scripts/voice-eval.cases.json` (the `audio` cases).
