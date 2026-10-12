import { Check, Type } from "lucide-react";
import { ACCENTS, FONTS, THEMES } from "@/lib/constants";
import type { AccentId, FontId, ThemeId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

export function AppearancePanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { theme, accent, font, scheme, setTheme, setAccent, setFont } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100%-1.5rem,40rem)]">
        <DialogTitle>ظاهر برنامه</DialogTitle>
        <DialogDescription>پوسته، رنگ تاکید و فونت فارسی را انتخاب کنید. تنظیمات روی همین دستگاه ذخیره می‌شود.</DialogDescription>

        <section className="mt-5">
          <h3 className="mb-2 text-[12px] font-medium text-subtle">پوسته</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {THEMES.map((t) => {
              const on = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id as ThemeId)}
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-xl border text-start transition-[border-color,box-shadow,transform] duration-150",
                    on ? "border-accent ring-2 ring-accent/30" : "border-border hover:border-border-strong",
                  )}
                >
                  <span
                    className="relative block h-12 w-full"
                    style={{
                      background: `linear-gradient(135deg, ${t.swatch[0]} 0%, ${t.swatch[1]} 70%)`,
                    }}
                  >
                    <span
                      className="absolute bottom-1.5 start-1.5 size-3.5 rounded-full border"
                      style={{ background: t.swatch[2], borderColor: "color-mix(in oklab, #000 20%, transparent)" }}
                    />
                    {on && (
                      <span className="absolute end-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-accent text-accent-fg">
                        <Check className="size-2.5" />
                      </span>
                    )}
                  </span>
                  <span className="px-2 py-1.5">
                    <span className="block text-[12px] font-medium leading-tight">{t.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-subtle">{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 text-[12px] font-medium text-subtle">رنگ تاکید</h3>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => {
              const on = accent === a.id;
              const color = scheme === "dark" ? a.dark : a.light;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccent(a.id as AccentId)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] font-medium transition-colors duration-150",
                    on ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
                  )}
                >
                  <span className="size-3.5 rounded-full" style={{ background: color }} />
                  {a.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-subtle">
            <Type className="size-3.5" />
            فونت
          </h3>
          <div className="grid gap-2">
            {FONTS.map((f) => {
              const on = font === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFont(f.id as FontId)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-start transition-colors duration-150",
                    on ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium">{f.label}</span>
                    <span className="text-[11px] text-subtle">{f.hint}</span>
                  </span>
                  <span className="mt-1 block text-[15px] leading-relaxed" style={{ fontFamily: f.stack }}>
                    {f.sample}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
