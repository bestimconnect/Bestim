-- Legal and business pages (2026-11-02): privacy, terms, support, delete-account, about.
-- One row per page, text in Arabic and English, edited in the dashboard (/dashboard/pages) and shown in the app and on the website.
-- body_* is plain text: "## Heading" starts a section, blank lines separate paragraphs, lines starting "- " are a list.
-- The five slugs are fixed (the stores link to some of them): rows can be edited, not added or deleted.

create table public.site_pages (
  slug text primary key check (slug ~ '^[a-z][a-z-]{1,29}$'),
  sort integer not null default 0,
  title_ar text not null check (length(title_ar) between 1 and 80),
  title_en text not null check (length(title_en) between 1 and 80),
  body_ar text not null default '' check (length(body_ar) <= 60000),
  body_en text not null default '' check (length(body_en) <= 60000),
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.site_pages enable row level security;

-- Public pages: the website reads them as anon, the app as anon or signed in. Only editors write, and only update.
grant select on public.site_pages to anon, authenticated;
grant update on public.site_pages to authenticated;

-- Two read policies: anon may not call can_edit_catalog(), so its policy cannot mention it.
create policy "anon reads published pages" on public.site_pages for select to anon using (is_published);
create policy "read published pages" on public.site_pages for select to authenticated
  using (is_published or public.can_edit_catalog());
create policy "editors update pages" on public.site_pages for update to authenticated
  using (public.can_edit_catalog()) with check (public.can_edit_catalog());

create trigger set_updated_at before update on public.site_pages for each row execute function extensions.moddatetime(updated_at);
-- Every edit by a signed-in person lands in the dashboard's activity log (log_catalog_change() expects an "id" column, so this one logs the slug).
create function public.log_page_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    insert into public.admin_audit_log (admin_id, action, target, detail)
    values (auth.uid(), 'page_update', 'site_pages:' || new.slug,
            jsonb_build_object('admin_email', (select email from auth.users where id = auth.uid()), 'name', new.title_en,
                               'before', to_jsonb(old), 'after', to_jsonb(new)));
  end if;
  return null;
end $$;
revoke execute on function public.log_page_change() from public, anon, authenticated;
create trigger log_page_change after update on public.site_pages for each row execute function public.log_page_change();

-- ─── The current texts (moved here from the website's legal.ts; about is a first draft for the founder to review) ───
insert into public.site_pages (slug, sort, title_ar, title_en, body_ar, body_en) values
  ('privacy', 1, $b$سياسة الخصوصية$b$, $b$Privacy Policy$b$,
   $b$خصوصيتك تهمنا. هنا نشرح بكلمات بسيطة ما الذي يجمعه تطبيق بستيم، ولماذا نجمعه، وماذا يمكنك أن تفعل ببياناتك. بياناتك تخصك أنت، ونحن لا نبيعها.

## من نحن

بستيم تطبيق لأصحاب السيارات. يساعدك على تسجيل الصيانة، ومتابعة المواعيد والمصاريف، وحفظ تاريخ موثوق لمركبتك.

الجهة الناشرة هي أحمد حمدي (فرد، مصر)، ويعمل باسم «بستيم». لا توجد شركة مسجّلة حتى الآن. الموقع: https://bestim-eg.com

## ما البيانات التي نجمعها ولماذا

نجمع فقط ما يلزم لتعمل الميزات التي تستخدمها:

- الحساب: اسمك وبريدك الإلكتروني، ويلزم حساب لاستخدام التطبيق (بريد وكلمة مرور، أو حساب Google). نستخدمهما لكي تسجّل دخولك وتجد بياناتك على أي هاتف. وإذا سجّلت الدخول بحساب Google نستلم أيضا رابط صورة حسابك في Google.
- السيارات: الماركة والموديل والسنة وقراءة العداد. ويمكنك اختياريا إضافة رقم اللوحة ورقم الهيكل.
- سجلات الصيانة: نوع الخدمة والتاريخ وقراءة العداد والتكلفة واسم الورشة والملاحظات.
- نص ما قلته بصوتك: عندما تسجّل بالصوت، يُحفظ نص كلامك مع السجل. التفاصيل في القسم التالي.
- التعديلات: يمكنك تعديل السجل بحرية خلال أول 24 ساعة. بعدها يلزم ذكر سبب قصير، ونحتفظ بالأصل ونعرضه بجانب التعديل. هذا يجعل التاريخ أكثر ثقة عند البيع. ويمكنك حذف أي سجل أو مصروف.
- المواعيد والمصاريف: المواعيد التي تضبطها والمبالغ التي تسجلها.
- صور الفواتير: الصور التي تختارها بنفسك من مكتبة صور هاتفك، وتُحفظ في مساحة خاصة بك.
- الإعدادات: تفضيلات التنبيهات واللغة والوضع الداكن.

## التسجيل بالصوت

عندما تسجّل بصوتك، يُرسَل التسجيل عبر خادم بستيم إلى خدمة ذكاء اصطناعي من Google اسمها Gemini. تكتب هذه الخدمة ما قلته، وتقترح لك السجلات المناسبة: صيانة أو مصروفات أو قراءة العداد. وفي أثناء كلامك، قد تعرض خدمة الكلام في هاتفك نفسه (من Apple أو Google بحسب هاتفك) معاينة حية للكلمات.

نرسل مع التسجيل أيضا قائمة مركباتك (الاسم والسنة وقراءة العداد)، ليعرف الذكاء الاصطناعي أي مركبة تقصد.

أنت تراجع كل سجل مقترح، ويمكنك تعديله أو حذفه قبل أن يُحفظ أي شيء.

بستيم لا تحتفظ بالتسجيل الصوتي. يُحذف من هاتفك فور كتابته نصا، ولا يحفظه خادمنا، ونطلب من Google ألا تحفظه. أما نص ما قلته فيُحفظ مع السجل.

إذا سجّلت بلا إنترنت، ينتظر التسجيل على هاتفك حتى يمكن إرساله. ويُحذف أيضا عندما تحذفه بنفسك، وعندما تسجّل الخروج.

التسجيل بالصوت يحتاج حسابا، وله حد يومي.

## الميكروفون والكاميرا والتنبيهات

نطلب أي إذن فقط عندما تستخدم الميزة التي تحتاجه، ويمكنك رفضه أو سحبه من إعدادات هاتفك في أي وقت.

- الميكروفون: للتسجيل بالصوت فقط.
- الكاميرا: لقراءة رقم العداد من لوحة السيارة. تتم القراءة على هاتفك فقط، بقارئ النصوص من Apple على iPhone ومن Google على Android. لا نحفظ ولا نرسل أي صورة أو فيديو.
- الصور: لإرفاق صورة فاتورة بسجل. تختارها أنت من مكتبة صور هاتفك، ولا نصل إلى غيرها. وتُحفظ في مساحة خاصة.
- التنبيهات: لتذكيرك بمواعيد الصيانة. تُجدول التذكيرات على هاتفك نفسه.

## أين تُحفظ بياناتك ومن يعالجها

تُحفظ بياناتك لدى Supabase، وهي مزوّد استضافة وقواعد بيانات. تعمل بستيم على حماية كل صف من البيانات بحيث يرى كل مستخدم بياناته هو فقط.

تستخدم بستيم خدمة Google في أمرين: تسجيل الدخول بحساب Google إذا اخترته (نستلم منها اسمك وبريدك ورابط صورة حسابك)، وخدمة الذكاء الاصطناعي في التسجيل بالصوت كما هو موضح أعلاه.

نستخدم خدمة بريد اسمها Resend لإرسال رسائل الحساب فقط، مثل «أكّد بريدك» و«أعد تعيين كلمة المرور».

لا توجد في بستيم إعلانات، ولا نستخدم أدوات تتبّع أو تحليلات.

## المشاركة مع الآخرين

لا يرى أحد بياناتك إلا إذا شاركتها أنت. عندما تشارك تاريخ مركبة برمز QR أو برابط، يحصل المستلم على نسخة من السجل. الرابط أو الرمز صالح لمدة 7 أيام ويعمل مرة واحدة. النسخة التي يستلمها الشخص لا تتضمن رقم اللوحة ولا رقم الهيكل ولا صور الفواتير ولا نص التسجيل الصوتي. ويرى المستلم عدد السجلات التي حُذفت بعد يومها الأول، دون أن يرى ما كانت.

عند التصدير بصيغة PDF أو CSV أو JSON، أنت تختار ما يُضمَّن في الملف. ما ترسله لغيرك يصبح في يده، ولا نستطيع سحبه منه.

لا نبيع بياناتك ولا نؤجّرها، ولا يوجد في بستيم أي إعلانات.

## مدة الاحتفاظ وحذف بياناتك

نحتفظ ببياناتك ما دام حسابك موجودا. عندما تحذف حسابك تُحذف بياناتك نهائيا، وتُمحى النسخ الاحتياطية خلال 30 يوما.

للحذف من داخل التطبيق: تبويب «حسابي»، ثم «حذف حسابي». وإن لم تستطع فتح التطبيق، أرسل لنا من بريد الحساب إلى bestim.connect@gmail.com. التفاصيل الكاملة في صفحة حذف الحساب.

يمكنك أيضا حذف سيارة واحدة أو أي سجل أو مصروف من داخل التطبيق.

## الأطفال

بستيم غير موجّه للأطفال دون 13 سنة، ولا نجمع عمدا بيانات منهم. إذا علمت أن طفلا أنشأ حسابا، راسلنا وسنحذفه.

## تغييرات على هذه السياسة

قد نعدّل هذه السياسة مع تطوّر التطبيق. سنضع التاريخ الجديد في أعلى الصفحة، وإذا كان التغيير مهما سنخبرك داخل التطبيق أو بالبريد.

## تواصل معنا

لأي سؤال عن خصوصيتك أو بياناتك، راسلنا على bestim.connect@gmail.com.$b$,
   $b$Your privacy matters to us. Here we explain in plain words what the Bestim app collects, why, and what you can do with your data. Your data is yours, and we do not sell it.

## Who we are

Bestim is an app for car owners. It helps you log maintenance, follow reminders and expenses, and keep a trustworthy history of your vehicle.

The publisher is Ahmed Hamdy (an individual, Egypt), operating as Bestim. There is no registered company yet. Website: https://bestim-eg.com

## What we collect and why

We collect only what is needed for the features you use:

- Account: your name and email. An account is required to use the app (email and password, or Google). We use them so you can sign in and find your data on any phone. If you sign in with Google, we also receive the link to your Google profile picture.
- Cars: make, model, year, and odometer reading. You may also add a plate number and VIN if you want.
- Maintenance logs: service type, date, odometer, cost, workshop name and notes.
- The text of what you said: when you log by voice, the text of your speech is saved with the record. See the next section.
- Changes: you can change a record freely during its first 24 hours. After that, a change needs a short reason, and we keep the original and show it next to the change. This makes the history more trustworthy when you sell. You can also delete any record or expense.
- Reminders and expenses: the reminders you set and the amounts you record.
- Receipt photos: the photos you choose yourself from your phone's photo library, kept in private storage.
- Settings: notification preferences, language and dark mode.

## Logging by voice

When you log by voice, the recording is sent through Bestim's server to an AI service from Google called Gemini. It writes down what you said and suggests the right records: maintenance, expenses or an odometer reading. While you speak, your phone's own speech service (from Apple or Google, depending on your phone) may show a live preview of the words.

Together with the recording, we send the list of your vehicles (name, year and odometer), so the AI can tell which vehicle you mean.

You review every suggested record, and you can edit or remove it before anything is saved.

Bestim does not keep the recording. It is deleted from your phone right after it is written up, our server does not store it, and we ask Google not to store it. The text of what you said is saved with the record.

If you record with no internet, the recording waits on your phone until it can be sent. It is also deleted when you delete it yourself, and when you sign out.

Voice logging needs an account, and it has a daily limit.

## Microphone, camera and notifications

We ask for a permission only when you use the feature that needs it. You can refuse it, or take it back in your phone settings at any time.

- Microphone: only for logging by voice.
- Camera: to read the odometer number from your dashboard. The reading happens on your phone itself, on your phone only, using Apple's text reader on iPhone and Google's on Android. No picture or video is saved or sent.
- Photos: to attach a receipt photo to a log. You choose it from your phone's photo library, and we cannot see any other photo. It is stored in private storage.
- Notifications: to remind you of maintenance. Reminders are scheduled on your phone itself.

## Where your data is stored and who processes it

Your data is stored with Supabase, a hosting and database provider. Bestim protects every row of data so that each user can see only their own.

Bestim uses Google for two things: signing in with a Google account, if you choose it (we receive your name, email and the link to your profile picture), and the AI service for voice logging, as explained above.

We use an email delivery service called Resend only to send account emails, such as Confirm your email and Reset your password.

Bestim has no ads, and we do not use tracking or analytics tools.

## Sharing with others

No one sees your data unless you share it. When you share a vehicle's history by QR code or link, the receiver gets a copy of the history. The link or code is valid for 7 days and works once. The copy the receiver gets does not include the plate number, the VIN, receipt photos or the text of voice logs. The receiver can see how many records were removed after their first day, but not what they were.

When you export as PDF, CSV or JSON, you choose what goes into the file. What you send to someone else is in their hands, and we cannot take it back.

We do not sell or rent your data, and Bestim has no ads.

## How long we keep data and how to delete it

We keep your data as long as your account exists. When you delete your account, your data is deleted permanently, and backups are cleared within 30 days.

To delete from inside the app: Account tab, then Delete my account. If you cannot open the app, email us from the account's email address at bestim.connect@gmail.com. The full details are on the Delete account page.

You can also delete a single car, or any record or expense, from inside the app.

## Children

Bestim is not directed at children under 13, and we do not knowingly collect data from them. If you learn that a child has created an account, write to us and we will delete it.

## Changes to this policy

We may update this policy as the app grows. We will put the new date at the top of the page, and if a change is important we will tell you in the app or by email.

## Contact us

For any question about your privacy or your data, write to us at bestim.connect@gmail.com.$b$);

insert into public.site_pages (slug, sort, title_ar, title_en, body_ar, body_en) values
  ('terms', 2, $b$شروط الاستخدام$b$, $b$Terms of Use$b$,
   $b$هذه هي القواعد البسيطة لاستخدام بستيم. اقرأها بهدوء، فهي تحميك وتحمينا.

## موافقتك على الشروط

باستخدامك تطبيق بستيم أو موقعه، أنت توافق على هذه الشروط وعلى سياسة الخصوصية. إذا لم توافق، من فضلك لا تستخدم التطبيق.

## ما هو بستيم

بستيم تطبيق لتسجيل صيانة المركبات بالصوت أو باليد، ومتابعة المواعيد والمصاريف، وحفظ تاريخ الخدمة ومشاركته عند البيع. الناشر هو أحمد حمدي (فرد، مصر)، ويعمل باسم «بستيم».

## حسابك

يلزم حساب لاستخدام بستيم. يمكنك الدخول بالبريد وكلمة المرور، أو بحساب Google.

أنت مسؤول عن حفظ كلمة مرورك، وعن كل ما يحدث في حسابك. إذا شككت أن أحدا دخل حسابك، راسلنا فورا.

## بياناتك ومسؤوليتك عنها

ما تسجّله في بستيم يبقى ملكك. تمنحنا فقط الحق في حفظه وعرضه لك، وفي مشاركته مع من تختاره أنت.

أنت مسؤول عن صحة ما تدخله: الأرقام والتواريخ والتكاليف. يمكنك تعديل السجل بحرية خلال أول 24 ساعة. بعدها يلزم ذكر سبب قصير، ويبقى الأصل ظاهرا بجانب التعديل. ويمكنك حذف أي سجل أو مصروف. وعند مشاركة التاريخ، يرى المستلم عدد السجلات المحذوفة بعد يومها الأول، دون أن يرى ما كانت. لا تدخل معلومات تعرف أنها غير صحيحة، خصوصا إذا كنت ستشاركها مع مشترٍ.

## السجلات المقترحة من الصوت

السجلات التي تُقترح من تسجيلك الصوتي تُنتجها خدمة ذكاء اصطناعي، وقد تكون خاطئة. راجع كل سجل قبل أن تحفظه، فأنت المسؤول عما تحفظه.

## المواعيد ليست نصيحة ميكانيكية

تنبيهات الصيانة في بستيم مجرد دليل يساعدك على التذكّر. ليست نصيحة فنية ولا بديلا عن الفحص.

اتبع دائما جدول الصيانة الذي تحدده الشركة المصنّعة، واستشر ميكانيكيا مؤهلا قبل أي قرار يخص سلامة مركبتك.

## مشاركة التاريخ لا تنقل الملكية

عندما تشارك تاريخ مركبة، يحصل المستلم على نسخة من السجل فقط. هذا لا ينقل ملكية المركبة قانونيا. نقل الملكية له إجراءاته الرسمية خارج بستيم.

نحن لا نضمن صحة السجلات التي يدخلها المستخدمون، ولا نتحقق من أي بيع.

## الاستخدام المقبول

من فضلك لا تستخدم بستيم في أي من الآتي:

- إدخال بيانات كاذبة أو مضللة لخداع مشترٍ أو أي شخص آخر.
- محاولة الوصول إلى حساب أو بيانات غيرك.
- تعطيل التطبيق أو خوادمه، أو محاولة اختراقهما.
- استخدام التطبيق لأي غرض مخالف للقانون.

## توفر الخدمة والتغييرات

نبذل جهدنا ليعمل بستيم دائما، لكن قد تتوقف الخدمة أحيانا للصيانة أو لأسباب خارجة عن إرادتنا. قد نغيّر ميزات التطبيق أو نضيف إليها أو نوقف بعضها.

قد نعدّل هذه الشروط أيضا. سنضع التاريخ الجديد في أعلى الصفحة، واستمرارك في الاستخدام بعد التعديل يعني موافقتك عليه.

## حدود المسؤولية

بستيم يُقدَّم كما هو، دون ضمانات بأنه سيعمل دائما بلا أخطاء أو انقطاع.

في أقصى حد يسمح به القانون، لا نتحمل مسؤولية أي ضرر ينتج عن الاعتماد على المواعيد أو السجلات، أو عن فقدان بيانات، أو عن قرار شراء أو بيع، أو عن عطل أو حادث في مركبتك. وهذا لا يلغي أي حق لك لا يجوز قانونا التنازل عنه.

## القانون الواجب التطبيق

تخضع هذه الشروط للقانون المصري.

## تواصل معنا

لأي سؤال عن هذه الشروط، راسلنا على bestim.connect@gmail.com.$b$,
   $b$These are the simple rules for using Bestim. Please read them calmly. They protect you and they protect us.

## Accepting these terms

By using the Bestim app or website, you agree to these terms and to the Privacy Policy. If you do not agree, please do not use the app.

## What Bestim is

Bestim is an app for logging vehicle maintenance by voice or by hand, following reminders and expenses, and keeping a service history you can share when you sell. The publisher is Ahmed Hamdy (an individual, Egypt), operating as Bestim.

## Your account

An account is required to use Bestim. You can sign in with email and password, or with a Google account.

You are responsible for keeping your password safe and for everything that happens in your account. If you think someone got into your account, write to us right away.

## Your content and your responsibility

What you record in Bestim stays yours. You only give us the right to store it, show it to you, and share it with the people you choose.

You are responsible for the accuracy of what you enter: numbers, dates and costs. You can change a record freely during its first 24 hours. After that, a change needs a short reason, and the original stays visible next to the change. You can delete any record or expense. When you share a history, the receiver sees how many records were removed after their first day, but not what they were. Do not enter information you know is untrue, especially if you will share it with a buyer.

## Records suggested from voice

Records suggested from your voice recording are produced by an AI service, and they can be wrong. Review every record before you save it. You are responsible for what you save.

## Reminders are not mechanical advice

Maintenance reminders in Bestim are only a helpful guide to help you remember. They are not technical advice and they do not replace an inspection.

Always follow the maintenance schedule set by the manufacturer, and ask a qualified mechanic before any decision about your vehicle's safety.

## Sharing a history does not transfer ownership

When you share a vehicle's history, the receiver gets a copy of the records only. This does not transfer legal ownership of the vehicle. Transferring ownership follows official procedures outside Bestim.

We do not guarantee that records entered by users are correct, and we do not check any sale.

## Acceptable use

Please do not use Bestim for any of the following:

- Entering false or misleading data to deceive a buyer or anyone else.
- Trying to reach another person's account or data.
- Disrupting the app or its servers, or trying to break into them.
- Using the app for anything against the law.

## Availability and changes

We try to keep Bestim working all the time, but the service may sometimes stop for maintenance or for reasons outside our control. We may change, add or remove features.

We may also update these terms. We will put the new date at the top of the page, and if you keep using the app after an update, it means you accept it.

## Limits of our liability

Bestim is provided as it is, with no promise that it will always work without errors or interruptions.

To the fullest extent the law allows, we are not responsible for any harm that comes from relying on reminders or records, from lost data, from a decision to buy or sell, or from a breakdown or accident of your vehicle. This does not take away any right you have that the law does not allow you to give up.

## Governing law

These terms are governed by the laws of Egypt.

## Contact us

For any question about these terms, write to us at bestim.connect@gmail.com.$b$);

insert into public.site_pages (slug, sort, title_ar, title_en, body_ar, body_en) values
  ('support', 3, $b$الدعم$b$, $b$Support$b$,
   $b$نحن هنا لمساعدتك. اكتب لنا وسنرد عليك بأسرع ما نستطيع.

## راسلنا

أرسل رسالتك إلى bestim.connect@gmail.com. يمكنك الكتابة بالعربية أو بالإنجليزية.

## ماذا تكتب في الرسالة

كلما كانت الرسالة أوضح، كان حل المشكلة أسرع. من فضلك اذكر:

- طراز هاتفك (مثلا iPhone 15 أو Samsung A54).
- لغة التطبيق عندك: العربية أو الإنجليزية.
- ماذا حدث بالضبط، وماذا كنت تتوقع أن يحدث. ولقطة شاشة تفيدنا كثيرا.

## متى سنرد عليك

نرد عادة خلال 3 أيام عمل.

## نسيت كلمة المرور

في شاشة تسجيل الدخول اضغط «نسيت كلمة المرور؟» وأدخل بريدك. سيصلك رابط لاختيار كلمة مرور جديدة. إذا لم يصل، تفقّد مجلد الرسائل غير المرغوبة.

## إضافة سجل

اضغط زر + ، وستفتح شاشة واحدة تضيف منها السجل: بالصوت أو باليد.

## تغيير اللغة

من تبويب «حسابي» اختر «اللغة» ثم اللغة التي تريدها. سيُعاد تشغيل التطبيق لتطبيقها.

## إضافة سيارة أخرى

من تبويب «سياراتي» أضف سيارة واختر الماركة والموديل من القائمة. يمكنك إضافة أكثر من سيارة والتنقل بينها.

## مشاركة تاريخ سيارة

من تبويب «حسابي» اضغط «شارك تاريخ السيارة»، ثم جهّز المشاركة واختر رمز QR أو الرابط. الرابط صالح لمدة 7 أيام، ويحصل المستلم على نسخة من السجل.$b$,
   $b$We are here to help. Write to us and we will reply as soon as we can.

## Write to us

Send your message to bestim.connect@gmail.com. You can write in Arabic or in English.

## What to put in your message

The clearer the message, the faster we can fix the problem. Please tell us:

- Your phone model (for example iPhone 15 or Samsung A54).
- The app language you use: Arabic or English.
- What exactly happened, and what you expected to happen. A screenshot helps a lot.

## When we will reply

We usually reply within 3 working days.

## I forgot my password

On the sign-in screen, tap Forgot password? and enter your email. You will get a link to choose a new password. If it does not arrive, check your spam folder.

## Add a record

Tap the + button. One sheet opens where you add the record, by voice or by hand.

## Change the language

In the Account tab, choose Language and then the language you want. The app will restart to apply it.

## Add another car

In the Cars tab, add a car and pick its brand and model from the list. You can add more than one car and switch between them.

## Share a vehicle's history

In the Account tab, tap Share car history, then prepare the share and choose the QR code or the link. The link is valid for 7 days, and the receiver gets a copy of the history.$b$);

insert into public.site_pages (slug, sort, title_ar, title_en, body_ar, body_en) values
  ('delete-account', 4, $b$حذف الحساب$b$, $b$Delete Account$b$,
   $b$هذه الصفحة تخص تطبيق «بستيم» (Bestim) الذي ينشره أحمد حمدي (فرد، مصر) باسم «بستيم». يمكنك حذف حسابك وبياناتك في أي وقت، وبطريقتين.

## الطريقة الأولى: من داخل التطبيق

اتبع هذه الخطوات:

- 1. افتح تطبيق بستيم وسجّل الدخول إلى حسابك.
- 2. اضغط تبويب «حسابي» في الشريط السفلي.
- 3. انزل إلى أسفل الشاشة واضغط «حذف حسابي».
- 4. ستظهر رسالة «حذف حسابك نهائيا؟». أكّد الحذف.

## الطريقة الثانية: بالبريد

إذا لم تستطع فتح التطبيق، أرسل لنا طلب حذف من البريد الإلكتروني المسجّل في حسابك إلى bestim.connect@gmail.com. اكتب في العنوان «حذف الحساب».

نتحقق أن الطلب من صاحب الحساب، ثم ننفّذه خلال 30 يوما.

## ما الذي يُحذف

يُحذف نهائيا، ولا يمكن استرجاعه بعد ذلك:

- حسابك وبياناتك الشخصية (الاسم والبريد).
- كل سياراتك.
- كل سجلات الصيانة، ومعها نص ما قلته بصوتك في هذه السجلات.
- كل التعديلات والتصحيحات التي أضفتها على السجلات.
- كل المواعيد والتذكيرات.
- كل المصاريف.
- كل صور الفواتير.

## ما الذي قد يبقى

- النسخ التي شاركتها مع شخص آخر قبل الحذف (عبر QR أو رابط). هذه النسخة أصبحت في يد المستلم ولا نستطيع حذفها من عنده.
- النسخ الاحتياطية. تُمحى بالكامل خلال 30 يوما من الحذف.$b$,
   $b$This page is about the Bestim app (بستيم), published by Ahmed Hamdy (an individual, Egypt) under the name Bestim. You can delete your account and data at any time, in two ways.

## Option 1: inside the app

Follow these steps:

- 1. Open the Bestim app and sign in to your account.
- 2. Tap the Account tab in the bottom bar.
- 3. Scroll to the bottom of the screen and tap Delete my account.
- 4. A message will ask Delete your account permanently? Confirm the deletion.

## Option 2: by email

If you cannot open the app, send us a deletion request from the email address registered to your account, to bestim.connect@gmail.com. Use Delete account as the subject.

We check that the request comes from the account owner, then carry it out within 30 days.

## What is deleted

The following is deleted permanently and cannot be recovered afterwards:

- Your account and personal details (name and email).
- All your cars.
- All maintenance logs, together with the text of your voice notes in those logs.
- All changes and corrections you added to logs.
- All reminders.
- All expenses.
- All receipt photos.

## What may remain

- Copies you already shared with someone else before deleting (by QR or link). That copy is now with the receiver, and we cannot delete it from them.
- Backups. They are cleared completely within 30 days of the deletion.$b$);

insert into public.site_pages (slug, sort, title_ar, title_en, body_ar, body_en) values
  ('about', 5, $b$عن بستيم$b$, $b$About Bestim$b$,
   $b$بستيم تطبيق عربي أولا لأصحاب السيارات، يجعل تاريخ صيانة سيارتك موثوقا وسهلا.

## ماذا يفعل بستيم

- تسجيل الصيانة بصوتك أو بيدك، مع صورة الفاتورة.
- تذكيرات بالمواعيد حسب العداد والوقت.
- متابعة المصاريف بالسنة والشهر والفئة.
- مشاركة تاريخ السيارة برابط أو رمز QR عند البيع.

## لماذا بستيم

التعديلات لا تمسح الأصل أبدا: يبقى السجل الأول ظاهرا بجانب التعديل، ولذلك يثق المشتري بالتاريخ.

## من نحن

الجهة الناشرة هي أحمد حمدي (فرد، مصر)، ويعمل باسم «بستيم». للتواصل: bestim.connect@gmail.com$b$,
   $b$Bestim is an Arabic-first app for car owners that makes your car's service history trustworthy and effortless.

## What Bestim does

- Log maintenance by voice or by hand, with a photo of the receipt.
- Reminders by mileage and time.
- Track expenses by year, month and category.
- Share the car's history by link or QR code when you sell.

## Why Bestim

A correction never erases the original: both stay visible, so a buyer can trust the history.

## Who we are

Published by Ahmed Hamdy (an individual, Egypt), operating under the name Bestim. Contact: bestim.connect@gmail.com$b$);
