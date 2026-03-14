import { useRef } from 'react';
import { Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export default function IconPicker({ value, onChange }: IconPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.focus();
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const text = e.currentTarget.value;
    // Extract the last emoji entered (in case of multiple)
    const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;
    const matches = text.match(emojiRegex);
    if (matches && matches.length > 0) {
      onChange(matches[matches.length - 1]);
      e.currentTarget.value = '';
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start h-10 font-normal gap-2"
        onClick={handleClick}
      >
        {value ? (
          <>
            <span className="text-lg leading-none">{value}</span>
            <span className="text-sm text-muted-foreground">Click to change</span>
          </>
        ) : (
          <>
            <Ban className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Click to pick an emoji</span>
          </>
        )}
      </Button>
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      )}
      {/* Hidden input to capture emoji keyboard input */}
      <input
        ref={inputRef}
        className="absolute inset-0 opacity-0 cursor-pointer"
        onInput={handleInput}
        autoComplete="off"
        aria-label="Emoji picker input"
      />
    </div>
  );
}
