import { BookOpen, ChevronDown, ChevronRight, FileText, FolderOpen, HelpCircle } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RawDocsModule = Record<string, string>;

type DocEntry = {
  id: string;
  title: string;
  path: string;
  content: string;
  sectionPath: string[];
};

type DocTreeNode = {
  name: string;
  path: string[];
  children: DocTreeNode[];
  docs: DocEntry[];
};

type MarkdownBlock =
  | { type: "heading"; level: number; content: string }
  | { type: "paragraph"; content: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; content: string }
  | { type: "table"; rows: string[][] };

const rawDocs = import.meta.glob("../../../../Docs/user/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true
}) as RawDocsModule;

function titleFromPath(filePath: string, content: string): string {
  const heading = content.split(/\r?\n/).find((line) => line.trim().startsWith("# "));
  if (heading) {
    return heading.trim().replace(/^#\s+/, "");
  }

  const filename = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "Document";
  return filename
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildDocs(): DocEntry[] {
  return Object.entries(rawDocs)
    .map(([filePath, content]) => {
      const relativePath = filePath.includes("/Docs/user/")
        ? filePath.split("/Docs/user/").pop() ?? filePath
        : filePath.replace(/^\.\.\/\.\.\/\.\.\/\.\.\/Docs\/user\//, "");
      const withoutExtension = relativePath.replace(/\.md$/, "");
      const segments = withoutExtension.split("/");
      return {
        id: withoutExtension,
        title: titleFromPath(relativePath, content),
        path: relativePath,
        content,
        sectionPath: segments.slice(0, -1)
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

function insertIntoTree(root: DocTreeNode, doc: DocEntry): void {
  let current = root;
  for (const segment of doc.sectionPath) {
    let child = current.children.find((entry) => entry.name === segment);
    if (!child) {
      child = {
        name: segment,
        path: [...current.path, segment],
        children: [],
        docs: []
      };
      current.children.push(child);
      current.children.sort((a, b) => a.name.localeCompare(b.name));
    }
    current = child;
  }

  current.docs.push(doc);
  current.docs.sort((a, b) => a.title.localeCompare(b.title));
}

function buildDocTree(docs: DocEntry[]): DocTreeNode {
  const root: DocTreeNode = { name: "root", path: [], children: [], docs: [] };
  docs.forEach((doc) => insertIntoTree(root, doc));
  return root;
}

function friendlySectionName(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = (lines[index] ?? "").trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("```") || line.startsWith("~~~")) {
      const fence = line.slice(0, 3);
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !(lines[index] ?? "").trim().startsWith(fence)) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", content: codeLines.join("\n") });
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      const match = /^(#{1,6})\s+(.*)$/.exec(line);
      if (match) {
        blocks.push({ type: "heading", level: match[1].length, content: match[2] });
      }
      index += 1;
      continue;
    }

    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? "").trim().startsWith("|")) {
        const row = (lines[index] ?? "")
          .trim()
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim());
        rows.push(row);
        index += 1;
      }
      const meaningfulRows = rows.filter((row, rowIndex) => !(rowIndex === 1 && row.every((cell) => /^:?-{3,}:?$/.test(cell))));
      blocks.push({ type: "table", rows: meaningfulRows });
      continue;
    }

    if (/^(?:[-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length) {
        const current = (lines[index] ?? "").trim();
        if (!current || !(ordered ? /^\d+\.\s+/.test(current) : /^[-*]\s+/.test(current))) {
          break;
        }
        items.push(current.replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = (lines[index] ?? "").trim();
      if (!current || current.startsWith("#") || current.startsWith("|") || /^(?:[-*]|\d+\.)\s+/.test(current) || current.startsWith("```") || current.startsWith("~~~")) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", content: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderInline(content: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = tokenRegex.exec(content);

  while (match) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`${match.index}-strong`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={`${match.index}-code`} className="rounded bg-slate-900/10 px-1.5 py-0.5 font-mono text-[0.95em] text-foreground dark:bg-white/10">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const isExternal = /^https?:\/\//.test(href);
        parts.push(
          <a
            key={`${match.index}-link`}
            href={href}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noreferrer" : undefined}
            className="font-medium text-primary underline underline-offset-4"
          >
            {label}
          </a>
        );
      }
    }

    lastIndex = match.index + token.length;
    match = tokenRegex.exec(content);
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

function renderHeading(level: number, content: string, key: string): JSX.Element {
  const className = level === 1
    ? "text-3xl font-semibold tracking-tight text-foreground"
    : level === 2
      ? "text-2xl font-semibold tracking-tight text-foreground"
      : level === 3
        ? "text-xl font-semibold text-foreground"
        : "text-lg font-semibold text-foreground";

  if (level === 1) return <h1 key={key} className={className}>{renderInline(content)}</h1>;
  if (level === 2) return <h2 key={key} className={className}>{renderInline(content)}</h2>;
  if (level === 3) return <h3 key={key} className={className}>{renderInline(content)}</h3>;
  return <h4 key={key} className={className}>{renderInline(content)}</h4>;
}

function renderBlock(block: MarkdownBlock, index: number): JSX.Element {
  switch (block.type) {
    case "heading":
      return renderHeading(block.level, block.content, `heading-${index}`);
    case "paragraph":
      return <p key={`paragraph-${index}`} className="leading-7 text-slate-700 dark:text-white/80">{renderInline(block.content)}</p>;
    case "list": {
      if (block.ordered) {
        return (
          <ol key={`list-${index}`} className="list-decimal space-y-2 pl-6 leading-7 text-slate-700 dark:text-white/80">
            {block.items.map((item, itemIndex) => (
              <li key={`list-${index}-${itemIndex}`}>{renderInline(item)}</li>
            ))}
          </ol>
        );
      }
      return (
        <ul key={`list-${index}`} className="list-disc space-y-2 pl-6 leading-7 text-slate-700 dark:text-white/80">
          {block.items.map((item, itemIndex) => (
            <li key={`list-${index}-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    }
    case "code":
      return (
        <pre key={`code-${index}`} className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-slate-950 px-4 py-3 text-sm text-slate-100 dark:border-white/10 dark:bg-black/60">
          <code>{block.content}</code>
        </pre>
      );
    case "table": {
      const [header, ...rows] = block.rows;
      return (
        <div key={`table-${index}`} className="overflow-x-auto rounded-2xl border border-slate-200/70 dark:border-white/10">
          <table className="min-w-full border-collapse text-sm">
            {header && (
              <thead className="bg-slate-100/70 dark:bg-white/5">
                <tr>
                  {header.map((cell, cellIndex) => (
                    <th key={`th-${cellIndex}`} className="border-b border-slate-200/70 px-3 py-2 text-left font-semibold text-foreground dark:border-white/10">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} className="align-top">
                  {row.map((cell, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`} className="border-t border-slate-200/70 px-3 py-2 text-slate-700 dark:border-white/10 dark:text-white/80">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }
}

function UserDocTree({
  node,
  selectedId,
  expanded,
  onToggleFolder,
  onSelectDoc,
  level = 0
}: {
  node: DocTreeNode;
  selectedId: string;
  expanded: Set<string>;
  onToggleFolder: (key: string) => void;
  onSelectDoc: (docId: string) => void;
  level?: number;
}): JSX.Element {
  return (
    <div className="space-y-1">
      {node.children.map((child) => {
        const key = child.path.join("/");
        const isOpen = expanded.has(key);
        return (
          <div key={key} className="space-y-1">
            <button
              type="button"
              onClick={() => onToggleFolder(key)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/75 dark:hover:bg-white/8 dark:hover:text-white"
              style={{ paddingLeft: `${0.5 + level * 0.75}rem` }}
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <FolderOpen className="h-4 w-4" />
              <span>{friendlySectionName(child.name)}</span>
            </button>
            {isOpen && (
              <UserDocTree
                node={child}
                selectedId={selectedId}
                expanded={expanded}
                onToggleFolder={onToggleFolder}
                onSelectDoc={onSelectDoc}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
      {node.docs.map((doc) => {
        const isActive = doc.id === selectedId;
        return (
          <button
            key={doc.id}
            type="button"
            onClick={() => onSelectDoc(doc.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
              isActive
                ? "bg-primary/12 text-primary"
                : "text-slate-700 hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/75 dark:hover:bg-white/8 dark:hover:text-white"
            }`}
            style={{ paddingLeft: `${1.75 + level * 0.75}rem` }}
          >
            <FileText className="h-4 w-4" />
            <span>{doc.title}</span>
          </button>
        );
      })}
    </div>
  );
}

export function HelpDocsPage(): JSX.Element {
  const docs = useMemo(() => buildDocs(), []);
  const docTree = useMemo(() => buildDocTree(docs), [docs]);
  const [searchParams, setSearchParams] = useSearchParams();
  const docParam = searchParams.get("doc");
  const selectedDoc = docs.find((doc) => doc.id === docParam) ?? docs[0] ?? null;
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["fundamentals", "features", "tutorials", "help", "admin"]));

  useEffect(() => {
    if (!selectedDoc) return;
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      let current = "";
      for (const segment of selectedDoc.sectionPath) {
        current = current ? `${current}/${segment}` : segment;
        next.add(current);
      }
      return next;
    });
  }, [selectedDoc?.id]);

  const blocks = useMemo(() => (selectedDoc ? parseMarkdown(selectedDoc.content) : []), [selectedDoc]);

  const selectDoc = (docId: string): void => {
    setSearchParams({ doc: docId });
  };

  const toggleFolder = (folder: string): void => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  return (
    <div className="min-h-[calc(100vh-5.25rem)] space-y-5 bg-transparent p-4 text-slate-900 dark:text-white/90 lg:p-6">
      <Card className="border-white/40 bg-white/45 backdrop-blur-xl dark:border-white/12 dark:bg-white/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-2xl">Help Centre</CardTitle>
              <CardDescription>
                Browse the FlowState user guides, tutorials, and feature references without leaving the app.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-h-0">
          <Card className="sticky top-24 border-white/40 bg-white/45 backdrop-blur-xl dark:border-white/12 dark:bg-white/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                User Documentation
              </div>
              <CardDescription>Open any guide from the directory tree below.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[calc(100dvh-11rem)] overflow-y-auto pr-2">
              <UserDocTree
                node={docTree}
                selectedId={selectedDoc?.id ?? ""}
                expanded={expandedFolders}
                onToggleFolder={toggleFolder}
                onSelectDoc={selectDoc}
              />
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0">
          <Card className="border-white/40 bg-white/45 backdrop-blur-xl dark:border-white/12 dark:bg-white/5">
            <CardHeader>
              <CardTitle>{selectedDoc?.title ?? "No document selected"}</CardTitle>
              <CardDescription>{selectedDoc?.path ?? "Choose a document from the sidebar."}</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDoc ? (
                <article className="space-y-5">
                  {blocks.map((block, index) => (
                    <Fragment key={`block-${index}`}>{renderBlock(block, index)}</Fragment>
                  ))}
                </article>
              ) : (
                <p className="text-sm text-muted-foreground">No user docs were found.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
