import { useState, useRef, useEffect } from 'react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export default function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (emojiData: EmojiClickData) => {
    onChange(emojiData.emoji);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start h-10 font-normal gap-2"
        onClick={() => setOpen(!open)}
      >
        {value ? (
          <>
            <span className="text-lg leading-none">{value}</span>
            <span className="text-sm text-muted-foreground">Click to change</span>
          </>
        ) : (
          <>
            <Ban className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Pick an emoji</span>
          </>
        )}
      </Button>
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(''); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          Clear
        </button>
      )}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1">
          <EmojiPicker
            onEmojiClick={handleSelect}
            theme={Theme.DARK}
            width={320}
            height={400}
            searchPlaceholder="Search emoji..."
            lazyLoadEmojis
          />
        </div>
      )}
    </div>
  );
}
