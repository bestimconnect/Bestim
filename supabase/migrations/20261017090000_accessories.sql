-- Accessories: things added to the car (dash cam, seat covers, audio...), each a service with no reminder.
-- A top category "Accessories" with one subcategory of the same name, then the 16 items. Pictures: src/lib/partArt.ts.
insert into public.record_categories (name_en, name_ar, sort)
select 'Accessories', 'إكسسوارات', 17
where not exists (select 1 from public.record_categories where name_en = 'Accessories' and parent_id is null);

insert into public.record_categories (parent_id, name_en, name_ar, icon, sort)
select p.id, 'Accessories', 'إكسسوارات', 'Sparkles', 29
from public.record_categories p
where p.name_en = 'Accessories' and p.parent_id is null
  and not exists (select 1 from public.record_categories c where c.parent_id = p.id);

insert into public.service_types (name_en, name_ar, category_id, has_reminder, default_interval_km, default_interval_months, fields, icon, sort)
select v.name_en, v.name_ar, c.id, false, null, null, '{brand}'::text[], 'Sparkles', v.sort
from (values
  ('Dash Cam', 'كاميرا السيارة', 40),
  ('Seat Covers', 'أغطية المقاعد', 41),
  ('Floor Mats', 'دواسات الأرضية', 42),
  ('Car Speakers', 'سماعات السيارة', 43),
  ('Window Tint', 'تظليل الزجاج', 44),
  ('Roof Rack', 'حامل السقف', 45),
  ('Phone Holder', 'حامل الهاتف', 46),
  ('Steering Wheel Cover', 'غطاء الدركسيون', 47),
  ('Sunshade', 'ستارة الشمس', 48),
  ('Parking Sensors', 'حساسات الركن', 49),
  ('Reverse Camera', 'كاميرا الرجوع', 50),
  ('LED Bulbs', 'لمبات LED', 51),
  ('Spoiler', 'سبويلر', 52),
  ('Car Cover', 'غطاء السيارة', 53),
  ('Air Freshener', 'معطر الجو', 54),
  ('Other Accessory', 'إكسسوار آخر', 55)
) as v(name_en, name_ar, sort)
join public.record_categories p on p.name_en = 'Accessories' and p.parent_id is null
join public.record_categories c on c.parent_id = p.id and c.name_en = 'Accessories'
where not exists (select 1 from public.service_types s where s.name_en = v.name_en);
