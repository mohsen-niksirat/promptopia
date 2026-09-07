# Contributing · راهنمای مشارکت

## 🇮🇷 فارسی

### افزودن پرامپت تازه

1. **دیتای خام:** خروجی تلگرام (`messages.html` + پوشه `photos/`) را در مسیر `work/` بریزید
   (این پوشه گیت‌ایگنور است و داخل مخزن قرار نمی‌گیرد).
2. **انتخاب پرامپت‌ها:** شناسه پیام‌ها (مثلاً `957`) را داخل `tools/curation.json` → بخش `selected` اضافه کنید.
   برای دیدن همه شناسه‌ها: `node tools/build.mjs parse`
3. **عنوان‌گذاری:** داخل `tools/editorial.json` یک خط اضافه کنید:

   ```json
   "957": ["پوستر نئون", "Neon Poster"]
   ```

   - عنصر اول: عنوان فارسی
   - عنصر دوم: عنوان انگلیسی
   - عنصر سوم (اختیاری): تغییر دسته‌بندی — یکی از:
     `portrait, family, travel, vehicles, food, animals, fantasy, product, utility, fashion`
4. **بیلد:** `cd tools && node build.mjs build`
   - عکس به‌صورت WebP بهینه می‌شود
   - صفحه اشتراک‌گذاری (`p/<id>/`) خودکار ساخته می‌شود
   - بدون عنوان در `editorial.json`، عنوان خودکار (از متن پرامپت) ساخته می‌شود — ولی عنوان دستی همیشه بهتر است.
5. **بررسی:** `node tools/validate.mjs` باید ✓ بدهد (در CI هم چک می‌شود).
6. کامیت و پوش کنید.

### نکته‌ها

- بدون عکس نمونه، پرامپت انتخاب نمی‌شود (`parse` رد می‌کند).
- اگر خواستید در صفحه‌بندی دست ببرید: `PER_PAGE` در `js/app.js`
- متن پرامپت‌ها را تغییر ندهید؛ فقط عنوان/دسته‌بندی از `editorial.json` کنترل می‌شود.

## 🇬🇧 English

### Adding a new prompt

1. **Raw data:** drop the Telegram export (`messages.html` + `photos/`) into `work/` (git-ignored).
2. **Select it:** add the message id to `tools/curation.json` → `selected`.
   List all ids with `node tools/build.mjs parse`.
3. **Title it:** add an entry in `tools/editorial.json`:

   ```json
   "957": ["Persian title", "English title", "optional-category"]
   ```

4. **Build:** `cd tools && node build.mjs build` (run `npm install` inside `tools/` first on a fresh clone).
   Images are optimized and the `/p/<id>/` share page is generated automatically.
   Without an editorial entry, a title is auto-derived from the prompt body.
5. **Validate:** `node tools/validate.mjs` must pass (CI runs it too).
6. Commit & push.

### Notes

- Prompts without an example photo are skipped by the parser.
- Tune pagination with `PER_PAGE` in `js/app.js`.
- Don't edit prompt texts by hand; titles/categories are controlled via `editorial.json`.

---

سوال دارید؟ → [GitHub — mohsen-niksirat](https://github.com/mohsen-niksirat) · [Telegram — @mohsenniksirat](https://t.me/mohsenniksirat)
