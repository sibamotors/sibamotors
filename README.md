# سیبا موتور — مدیریت کار تیمی

برنامه‌ی وب (کانبان، پیام‌رسان، گزارش، دسترسی‌ها) با **TanStack Start + React + Postgres**، اجرا روی **Render**.

## اجرا روی Render
راهنمای قدم‌به‌قدم: [`docs/DEPLOY-FA.md`](docs/DEPLOY-FA.md)

| تنظیم | مقدار |
|---|---|
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` (ابتدا migration دیتابیس، بعد سرور) |
| Health Check Path | `/login` |

### متغیرهای محیطی (Render → Environment)
| نام | توضیح |
|---|---|
| `DATABASE_URL` | آدرس Postgres (الزامی) |
| `SESSION_SECRET` | حداقل ۳۲ کاراکتر تصادفی؛ برای امضای کوکی ورود (الزامی) |
| `ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD` | ساخت اولین ادمین (فقط وقتی ادمین فعالی وجود ندارد) |

نمونه: `.env.example`

## امنیت (خلاصه)
- نشست سمت سرور با کوکی `HttpOnly` امضاشده؛ هویت کاربر هرگز از ورودی مرورگر خوانده نمی‌شود.
- همه‌ی توابع سرور با middleware احراز هویت/ادمین/دسترسی محافظت می‌شوند.
- رمزها با scrypt هش می‌شوند؛ ۵ تلاش ناموفق = قفل ۱۵ دقیقه‌ای.
- فایل‌ها فقط برای فرستنده/گیرنده‌ی همان پیام قابل دانلود هستند و فقط نوع‌های امن با MIME واقعی ارائه می‌شوند.
- هدرهای امنیتی (CSP، HSTS، …) روی همه‌ی پاسخ‌ها.

## توسعه‌ی محلی
```bash
npm ci
cp .env.example .env      # DATABASE_URL و SESSION_SECRET را پر کنید
npm run dev               # http://localhost:8080
npm run typecheck && npm run lint && npm test
```
بدون `DATABASE_URL` در حالت توسعه یک دیتابیس محلی (PGlite) ساخته می‌شود.

## نکات
- فقط **یک** نمونه (instance) از برنامه روی Render اجرا شود (قفل نوشتن workspace داخل همین پروسه است).
- مهاجرت‌ها در پوشه‌ی `migrations/` هستند و در هر استارت به‌صورت خودکار اجرا می‌شوند.
