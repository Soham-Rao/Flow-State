import { useEffect, useMemo, useState } from "react";

const DEFAULT_CHUNK_SIZE = 1400;
const MIN_CHUNK_BREAK = 700;

function resolveChunkEnd(text: string, start: number, chunkSize: number): number {
  const maxEnd = Math.min(start + chunkSize, text.length);
  if (maxEnd >= text.length) return text.length;

  const candidates = ["\n\n", "\n", ". ", "! ", "? ", " "];
  let best = -1;

  for (const candidate of candidates) {
    const index = text.lastIndexOf(candidate, maxEnd);
    if (index > start + MIN_CHUNK_BREAK && index > best) {
      best = index + candidate.length;
    }
  }

  return best > 0 ? best : maxEnd;
}

function splitLongText(text: string, chunkSize: number): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = resolveChunkEnd(text, start, chunkSize);
    const chunk = text.slice(start, end).trimEnd();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    start = end;
    while (start < text.length && text[start] === " ") {
      start += 1;
    }
  }

  return chunks.length > 0 ? chunks : [text];
}

export interface ThreadExpandableTextProps {
  text: string;
  className?: string;
  chunkSize?: number;
}

export function ThreadExpandableText({
  text,
  className,
  chunkSize = DEFAULT_CHUNK_SIZE
}: ThreadExpandableTextProps): JSX.Element {
  const chunks = useMemo(() => splitLongText(text, chunkSize), [chunkSize, text]);
  const [visibleChunkCount, setVisibleChunkCount] = useState(1);

  useEffect(() => {
    setVisibleChunkCount(1);
  }, [text, chunkSize]);

  if (chunks.length === 1) {
    return <p className={className}>{text}</p>;
  }

  const visibleChunks = chunks.slice(0, visibleChunkCount);
  const hasMore = visibleChunkCount < chunks.length;
  const canCollapse = visibleChunkCount > 1;

  return (
    <div className="space-y-3">
      {visibleChunks.map((chunk, index) => (
        <p key={`${index}-${chunk.length}`} className={className}>
          {chunk}
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {hasMore && (
          <button
            type="button"
            className="rounded-full border border-border/60 px-2 py-0.5 font-semibold text-primary/80 hover:text-primary"
            onClick={() => setVisibleChunkCount((count) => Math.min(chunks.length, count + 1))}
          >
            Read more
          </button>
        )}
        {canCollapse && (
          <button
            type="button"
            className="rounded-full border border-border/60 px-2 py-0.5 font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => setVisibleChunkCount((count) => Math.max(1, count - 1))}
          >
            Read less
          </button>
        )}
        <span>
          {visibleChunkCount}/{chunks.length}
        </span>
      </div>
    </div>
  );
}
