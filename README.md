<div align="center">

<img src="assets/favicon.svg" width="72" alt="Promptopia logo" />

# پرامپتوپیا · Promptopia

**گالری پرامپت‌های آماده هوش مصنوعی — کپی کن، در جیمینای یا چت‌جی‌پی‌تی بساز**

A bilingual (FA/EN) gallery of ready-made AI image prompts — copy and create in Gemini or ChatGPT.

![PWA](https://img.shields.io/badge/PWA-offline--ready-8b5cf6)
![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-d946ef)
![No Framework](https://img.shields.io/badge/framework-none-f59e0b)
![License](https://img.shields.io/badge/content-Personal%20Collection-9aa1b5)

[🌐 مشاهده سایت / Visit the site](https://mohsen-niksirat.github.io/promptopia/)

</div>

---

## 🇮🇷 درباره

پرامپتوپیا یک گالری سریع و زیباست برای **۱٬۳۶۶+ پرامپت آمادهٔ تصویرسازی با هوش مصنوعی**؛ هر پرامپت با عکس نمونهٔ واقعی، متن کامل انگلیسی و دسته‌بندی دقیق. پرامپت را کپی کن، عکس خودت را همراهش در **Google Gemini** یا **ChatGPT** بفرست — همین!

### ✨ امکانات

- **۱٬۳۶۶ پرامپت** با عکس نمونه واقعی — صفحه‌بندی‌شده (۲۴ در هر صفحه)
- **نصب‌شدنی و آفلاین (PWA)** — با Service Worker و Manifest
- جستجوی آنی فارسی/انگلیسی + **۱۸ بخش دسته‌بندی** هرکدام با صفحه‌بندی مستقل + مرتب‌سازی
- **کپی یک‌کلیکی** متن کامل هر پرامپت
- دکمه‌های «استفاده رایگان» با باز کردن مستقیم **Google Gemini / ChatGPT**
- نسخه‌های چندگانه هر پرامپت (مثلاً زنانه/مردانه) با تب داخل مودال
- علاقه‌مندی‌ها (با خروجی/ورودی JSON)، اشتراک‌گذاری با لینک مستقیم، **پرامپت روز**، **دکمه تصادفی** 🎲، **۱۰ تم رنگی**، دو زبانه RTL/LTR
- **کیبورد:** `/` برای جستجو و فلش‌های چپ/راست برای جابه‌جایی بین پرامپت‌های بازشده
- تصاویر سه‌سایزه (full/480/blur) با **srcset + blur-up** — لود سریع‌تر و کم‌حجم‌تر
- طراحی موبایل‌فرست با انیمیشن‌های نرم

### 🚀 اجرا روی GitHub Pages

1. مخزن را Fork یا Clone کن.
2. **Settings ▸ Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)`.
3. سایت روی `https://<username>.github.io/<repo>/` بالا می‌آید.

> همهٔ مسیرها نسبی هستند؛ سایت در زیرپوشه هم درست کار می‌کند. `.nojekyll` هم لازم است که کنار بقیه فایل‌ها هست.

---

## 🇬🇧 About

Promptopia is a fast, beautiful gallery of **1,366+ ready-made AI image prompts** — each with a real example image, full English prompt text and a precise category. Copy the prompt, attach your photo in **Google Gemini** or **ChatGPT**, and create.

### ✨ Features

- **1,366 prompts** with real example images — paginated (24 per page)
- **Installable & offline-ready PWA** — service worker + web manifest
- Instant FA/EN search, **18 category sections** with per-section pagination, sorting
- **One-click copy** of the full prompt text
- “Use free” buttons opening **Google Gemini / ChatGPT** directly
- Multi-variant prompts (e.g. female/male) with tabs in the modal
- Favorites (with JSON export/import), shareable `#p<id>` links, **prompt of the day**, **random prompt** 🎲, **10 color themes**, full RTL/LTR bilingual UI
- **Keyboard:** `/` focuses search, ←/→ move between open prompt modals
- Three image sizes (full/480/blur) with **srcset + blur-up** for faster, lighter loading
- Mobile-first design with smooth animations

### 🚀 Deploy to GitHub Pages

1. Fork or clone this repo.
2. **Settings ▸ Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)`.
3. Your site goes live at `https://<username>.github.io/<repo>/`.

> All asset paths are relative, so the site works under any sub-path. `.nojekyll` is included.

---

## 🗂 ساختار / Structure

```
index.html              صفحه اصلی / main page
manifest.webmanifest    PWA manifest
sw.js                   سرویس‌ورکر آفلاین / offline service worker
css/style.css           دیزاین سیستم / design system
js/i18n.js              دیکشنری فارسی/انگلیسی / FA-EN dictionary
js/app.js               منطق گالری / gallery logic
data/prompts.js         دیتای پرامپت‌ها (تولیدشده) / generated data
assets/img/*.webp       عکس‌های بهینه‌شده / optimized images
tools/                  اسکریپت بیلد / build pipeline (Node + sharp)
tools/bump.mjs          افزایش نسخهٔ کش / release cache-bust bumper
tools/curate-titles.mjs بازنویسی خودکار عنوان‌های ضعیف / auto title curation
```

## 🛠 شخصی‌سازی / Customization

- **عنوان‌ها / Titles:** `tools/editorial.json` → `"<id>": ["عنوان فارسی", "English title"]`
- **دسته‌بندی / Category:** همان فایل، عنصر سوم اختیاری → `["fa", "en", "vehicles"]`
- **تعداد در صفحه / Page size:** `PER_PAGE` در `js/app.js`
- **انتشار / Release:** بعد از هر تغییر در css/js/index/sw، نسخهٔ کش را با `cd tools && node bump.mjs` یکی بالا ببر (index.html و `sw.js` با هم هماهنگ می‌شوند)
- بعد از تغییرات دیتا: `cd tools && node build.mjs build` (نیاز به `npm install` داخل `tools/`)

---

## 📊 آمار بازدید / Analytics (GoatCounter)

آمار با [GoatCounter](https://www.goatcounter.com) جمع‌آوری می‌شود — رایگان، بدون کوکی و حریم‌خصوصی‌پسند:

1. یک سایت رایگان در [goatcounter.com/signup](https://www.goatcounter.com/signup) بساز و دامنهٔ اصلی‌ات را وارد کن (مثلاً `mohsen-niksirat.github.io`).
2. کد سایتت را بردار (همان `xxx` در آدرس `https://xxx.goatcounter.com`).
3. در `index.html` مقدار `window.GOATCOUNTER_SITE` را از `YOUR-CODE` به کد واقعی تغییر بده.

بازدیدهای هش‌روت (`#p<id>`، `#s-<cat>-page-N`) جداگانه شمارش می‌شوند. GoatCounter به‌طور پیش‌فرض localhost را نادیده می‌گیرد، پس فقط روی سایت منتشرشده فعال می‌شود.

---

## 👤 سازنده / Author

**محسن نیک‌سیرت · Mohsen Niksirat**

[![GitHub](https://img.shields.io/badge/GitHub-mohsen--niksirat-181717?logo=github)](https://github.com/mohsen-niksirat)
[![Telegram](https://img.shields.io/badge/Telegram-@mohsenniksirat-26A5E4?logo=telegram)](https://t.me/mohsenniksirat)

- GitHub: [github.com/mohsen-niksirat](https://github.com/mohsen-niksirat)
- Telegram: [t.me/mohsenniksirat](https://t.me/mohsenniksirat)

---

<div align="center">

ساخته‌شده با ❤ · Made with ❤ · 🤖 Generated with Codebuff

</div>
