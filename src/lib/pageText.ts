export type Block = { type: 'h' | 'p' | 'ul'; text?: string; items?: string[] };

// The page text format written in the dashboard: "## Heading", blank-line paragraphs, "- " list lines.
// Same parser as the website's src/lib/pages.ts.
export const parseBody = (body: string): Block[] =>
  body.split(/\n\s*\n/).flatMap((chunk): Block[] => {
    const text = chunk.trim();
    if (!text) return [];
    if (text.startsWith('## ')) {
      const [head, ...rest] = text.split('\n');
      return [{ type: 'h', text: head.slice(3).trim() }, ...parseBody(rest.join('\n'))];
    }
    const lines = text.split('\n');
    return lines.every((l) => l.startsWith('- ')) ? [{ type: 'ul', items: lines.map((l) => l.slice(2).trim()) }] : [{ type: 'p', text }];
  });
