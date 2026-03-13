import { useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { filterMentionCandidates, findMentionQuery, insertMention, type MentionQuery } from "@/lib/mentions";
import type { BoardMember } from "@/types/board";

interface MentionsFieldProps {
  value: string;
  onChange: (value: string) => void;
  members: BoardMember[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  "data-testid"?: string;
}

const MAX_SUGGESTIONS = 6;

export function MentionsField({
  value,
  onChange,
  members,
  placeholder,
  className,
  disabled,
  multiline,
  rows,
  "data-testid": dataTestId
}: MentionsFieldProps): JSX.Element {
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [queryInfo, setQueryInfo] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const suggestions = useMemo(() => {
    const query = queryInfo?.query ?? "";
    return filterMentionCandidates(query, members).slice(0, MAX_SUGGESTIONS);
  }, [members, queryInfo]);

  const isOpen = Boolean(queryInfo && suggestions.length > 0);

  const syncQueryFromValue = (nextValue: string, caretOverride?: number): void => {
    const caret = caretOverride ?? fieldRef.current?.selectionStart ?? nextValue.length;
    const info = findMentionQuery(nextValue, caret);
    setQueryInfo(info);
    setActiveIndex(0);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const nextValue = event.target.value;
    onChange(nextValue);
    syncQueryFromValue(nextValue, event.target.selectionStart ?? nextValue.length);
  };

  const handleSelect = (member: BoardMember): void => {
    if (!queryInfo) return;
    if (!member.username) return;
    const { nextValue, nextCaret } = insertMention(value, queryInfo, member.username);
    onChange(nextValue);
    setQueryInfo(null);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      if (fieldRef.current) {
        fieldRef.current.selectionStart = nextCaret;
        fieldRef.current.selectionEnd = nextCaret;
        fieldRef.current.focus();
      }
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (!isOpen) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const selected = suggestions[activeIndex];
      if (selected) {
        handleSelect(selected);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setQueryInfo(null);
    }
  };

  const handleBlur = (): void => {
    setTimeout(() => {
      setQueryInfo(null);
    }, 120);
  };

  const field = multiline ? (
    <textarea
      ref={fieldRef as React.Ref<HTMLTextAreaElement>}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onClick={() => syncQueryFromValue(value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      data-testid={dataTestId}
      className={cn(
        "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  ) : (
    <Input
      ref={fieldRef as React.Ref<HTMLInputElement>}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onClick={() => syncQueryFromValue(value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={dataTestId}
      className={className}
    />
  );

  return (
    <div className="relative w-full">
      {field}
      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <ul className="max-h-48 overflow-auto py-1 text-xs">
            {suggestions.map((member, index) => {
              const active = index === activeIndex;
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleSelect(member);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left",
                      active ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span className="font-medium">{member.displayName ?? member.username ?? "Member"}</span>
                    <span className="text-[10px] text-slate-500">@{member.username ?? "unknown"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}


