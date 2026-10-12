# راهنمای قدم‌به‌قدم: جایگزینی پروژه و دیپلوی روی Render

> این راهنما برای کسی نوشته شده که تازه‌کار است. هر مرحله را **به ترتیب** و **دقیقاً** انجام بده.
> ⚠️ ترتیب مهم است: اول Render را آماده کن (بخش ۲)، بعد کد را روی GitHub بگذار (بخش ۳).

---

## بخش ۰ — قبل از هر کاری: پشتیبان بگیر

1. وارد سایتت شو (با ادمین فعلی).
2. از منوی کاربر، گزینه‌ی **پشتیبان‌گیری (Export)** را بزن و فایل JSON را روی کامپیوترت نگه دار.
3. (اختیاری ولی خوب) در Render → دیتابیس Postgres → تب **Backups** را نگاه کن؛ اگر پلن‌ات پشتیبان دارد، یک نسخه بساز.

---

## بخش ۱ — این ZIP را باز کن

1. فایل `sibamotor-secure.zip` را روی کامپیوترت **Extract** (Unzip) کن.
2. داخلش پوشه‌ی `sibamotor-main` است. داخل آن پوشه، فایل‌هایی مثل `package.json`، `src`، `server`، `scripts`، `migrations` و … را می‌بینی.
3. فایل‌هایی که با نقطه شروع می‌شوند (`.gitignore`، `.github`، `.env.example`، `.nvmrc`) **هم باید کپی شوند**. اگر در ویندوز نمی‌بینی‌شان: در File Explorer → View → تیک **Hidden items** را بزن.

---

## بخش ۲ — Render را آماده کن (قبل از آپلود روی GitHub!)

چون Render با هر تغییر در GitHub خودکار دیپلوی می‌کند، تنظیمات را اول بده.

### ۲-۱) سه متغیر محیطی
1. وارد [dashboard.render.com](https://dashboard.render.com) شو → روی **سرویس وب‌سایتت** کلیک کن.
2. در منوی چپ روی **Environment** کلیک کن.
3. بررسی کن `DATABASE_URL` از قبل هست (اگر هست، دست نزن).
4. دکمه‌ی **Add Environment Variable** را بزن و این‌ها را اضافه کن:

| Key | Value |
|---|---|
| `SESSION_SECRET` | یک رشته‌ی تصادفی **حداقل ۳۲ حرفی**. اگر دکمه‌ی **Generate** هست همان را بزن. اگر نیست، روی کامپیوتر Node داری؟ در ترمینال بزن: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` و خروجی را بگذار. این رمز را به **هیچ‌کس** نده و جایی منتشر نکن. |
| `ADMIN_BOOTSTRAP_USERNAME` | نام کاربری ادمین، با حروف کوچک انگلیسی. مثلاً `h.mojarad` |
| `ADMIN_BOOTSTRAP_PASSWORD` | یک رمز **قوی و حداقل ۱۰ کاراکتر** که فقط خودت می‌دانی (حرف + عدد + علامت). |

5. **Save Changes** را بزن. (ممکن است Render بپرسد دیپلوی دوباره بشود؛ اشکال ندارد، فعلاً کد قدیمی است.)

> چرا؟ قبلاً سه کاربر با رمز مشترک `A123456a` داخل کد روی GitHub بودند. این رمز لو رفته حساب می‌شود. حالا اولین دیپلوی، آن حساب‌ها را **قفل** می‌کند و ادمین جدید را با رمز تو می‌سازد.

### ۲-۲) دستورهای Build و Start
1. در منوی چپ **Settings** را بزن.
2. **Build Command** را بگذار: `npm ci && npm run build`
3. **Start Command** را بگذار: `npm start`
   (قبلاً شاید `node .output/server/index.mjs` بود؛ حالا `npm start` اول دیتابیس را به‌روز می‌کند و بعد سایت را بالا می‌آورد.)
4. **Health Check Path** را بگذار: `/login`
5. پایین‌تر مطمئن شو **Instances = 1** است. (برنامه فقط با یک نمونه درست کار می‌کند.)
6. **Save Changes**.

---

## بخش ۳ — کد جدید را روی GitHub بگذار

### روش A (پیشنهادی): با Git روی کامپیوتر
اگر Git نصب نداری: [git-scm.com/downloads](https://git-scm.com/downloads) را نصب کن. در ویندوز برنامه‌ی **Git Bash** را باز کن.

```bash
# 1) پروژه‌ات را از GitHub بگیر (آدرس ریپوی خودت را بگذار)
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO

# 2) همه‌ی فایل‌های قدیمی را حذف کن (فقط پوشه‌ی .git می‌ماند)
git rm -r -q .

# 3) اگر هنوز پوشه‌هایی مثل node_modules باقی مانده، دستی پاکشان کن
```
4. حالا در File Explorer پوشه‌ی `YOUR-REPO` را باز کن (باید تقریباً خالی باشد).
5. **همه‌ی محتویات** پوشه‌ی `sibamotor-main` (از ZIP) را کپی کن و داخل `YOUR-REPO` Paste کن. (خود پوشه‌ی sibamotor-main را نه، **محتویاتش** را.)
6. دوباره در Git Bash:

```bash
git add -A
git status          # لیست تغییرات را ببین؛ باید فایل‌های جدید مثل docs/DEPLOY-FA.md باشند
git commit -m "Security hardening: server sessions, access control, cleanup"
git push
```
اگر Git نام و ایمیل خواست:
```bash
git config --global user.name "نام تو"
git config --global user.email "email@example.com"
```

### روش B: فقط با مرورگر (سخت‌تر)
1. در GitHub وارد ریپو شو. هر **پوشه** (src, scripts, server, migrations, public, …) را باز کن → بالا سمت راست `⋯` → **Delete directory** → Commit.
2. فایل‌های بیرونی (package.json و …) را یکی‌یکی باز کن → آیکن سطل زباله → Commit.
3. **Add file → Upload files** → فایل‌ها و پوشه‌های جدید را بکش و رها کن. (GitHub هر بار حداکثر ۱۰۰ فایل می‌پذیرد؛ در چند دسته آپلود کن.) پوشه‌ی `.github` و فایل‌های نقطه‌دار را هم یادت نرود.
4. **Commit changes**.

> ⛔ فقط آپلود روی فایل‌های قدیمی کافی **نیست**؛ فایل‌های قدیمی (مثل `src/lib/auth`) باید پاک شوند.

---

## بخش ۴ — دیپلوی را ببین

1. Render → سرویس → **Events/Logs**. دیپلوی خودکار شروع می‌شود (۳ تا ۸ دقیقه).
2. در Logs دنبال این خط‌ها بگرد (یعنی درست است):
   - `[migrate] applied 0008_security.sql`
   - `[migrate] applied 0009_timestamptz.sql`
   - `[bootstrap] LOCKED …` (برای حساب‌های قدیمی با رمز پیش‌فرض)
   - `[bootstrap] admin "…" is ready`
3. وقتی بالای صفحه نوشت **Live** یعنی سایت بالاست.
4. اگر **Failed** شد: Logs را کامل کپی کن و برای من بفرست.

---

## بخش ۵ — اولین ورود

1. سایت را باز کن (اگر صفحه‌ی قدیمی دیدی Ctrl+F5).
2. با `ADMIN_BOOTSTRAP_USERNAME` و `ADMIN_BOOTSTRAP_PASSWORD` وارد شو.
3. از تو می‌خواهد **رمز جدید** بگذاری (حداقل ۸ کاراکتر). رمز دلخواه و قوی بگذار.
4. منوی **کاربران** → برای هر همکاری که حسابش قفل شده، **رمز جدید موقت** بگذار و به خودش بگو؛ در اولین ورود خودش رمزش را عوض می‌کند.
5. وقتی ادمین‌ات درست کار کرد: در Render → Environment → **`ADMIN_BOOTSTRAP_PASSWORD` را حذف کن** (امن‌تر است).

### چک‌لیست تست
- [ ] ورود و خروج
- [ ] ساخت کارت و جابه‌جایی کارت
- [ ] ارسال پیام و فایل
- [ ] ۵ بار رمز اشتباه → پیام «۱۵ دقیقه بعد» (بعد از تست، در Render قفل خودش باز می‌شود)
- [ ] کاربر عادی نباید منوی «کاربران» را ببیند

---

## اگر مشکلی پیش آمد

| علامت | علت و راه‌حل |
|---|---|
| لاگ: `SESSION_SECRET is missing` | بخش ۲-۱ را انجام بده و دوباره Deploy کن. |
| لاگ: `DATABASE_URL is not set` | متغیر `DATABASE_URL` را از Postgres Render کپی کن (Internal Database URL). |
| صفحه‌ی خالی/سفید | موقتاً `DISABLE_CSP` = `1` را در Environment بگذار و Deploy کن؛ خطای مرورگر (F12 → Console) را برایم بفرست. |
| نمی‌توانم وارد شوم | لاگ‌ها را نگاه کن: `[bootstrap] WARNING: there is no admin` یعنی `ADMIN_BOOTSTRAP_*` را نگذاشته‌ای. |
| `Failed` در Build | لاگ را برایم بفرست. (من نتوانستم در محیط خودم build واقعی بزنم.) |
| می‌خواهم برگردم به نسخه‌ی قبل | Render → Events → Rollback. ⚠️ بعد از migration شماره‌ی 0009 برگشتن به کد قدیمی ممکن است پیام‌ها را خراب نشان دهد؛ بهتر است به‌جای برگشت، خطا را به من بدهی. |

## چیزهایی که بعداً می‌توانی پاک کنی (اختیاری)
- `scripts/legacy-backfill.mjs` و خط import آن در `scripts/bootstrap.mjs` (بعد از اولین دیپلوی موفق).
- پکیج‌های بی‌استفاده‌ی `better-auth`، `kysely`، `jose` و … (`npm uninstall` + commit فایل `package-lock.json`).
