import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

/** Official Siba Motor mark: three stacked downward chevrons. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-[22%] bg-[#111111]",
        className,
      )}
      aria-hidden
    >
      <img src="/logo.png" alt="" className="h-[68%] w-[78%] object-contain" />
    </span>
  );
}

export function LogoWord({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
    </div>
  );
}