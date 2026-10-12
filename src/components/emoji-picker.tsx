import { Smile } from "lucide-react";
import { useState } from "react";
import { EMOJI_GROUPS } from "@/lib/emoji";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="افزودن ایموجی">
          <Smile />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="k-scroll max-h-64 overflow-y-auto pe-1">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="mb-1 px-1 text-[11px] font-medium text-subtle">{group.label}</p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.items.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="grid size-8 place-items-center rounded-lg text-lg hover:bg-accent-soft"
                    onClick={() => {
                      onPick(emoji);
                      setOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
