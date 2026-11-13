// Bestim Team tracker as an MCP server (bugs and tasks), so an admin's Claude can list, file and update items.
// Sign-in: the admin's personal key (made on the dashboard, Team > Connect), in the URL (?key=...) or as "Authorization: Bearer ...".
// Every call goes through the database function team_mcp(), which checks the key and runs the same team_* functions the
// dashboard uses, as that admin. The service key below is used only to store and sign screenshots, never to read the tracker.
// Deploy with JWT check OFF (verify_jwt = false): the key is the credential.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE = 'https://bestim-eg.com/dashboard/team';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
const files = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const ENUMS = {
  severity: ['Blocker', 'High', 'Medium', 'Low'],
  priority: ['High', 'Medium', 'Low'],
  platform: ['iPhone', 'Android', 'Web', 'Both'],
  area: ['App', 'Store', 'Website', 'Connect', 'Backend'],
  owner: ['Shady', 'Ahmed', 'Daytwo'],
};
const BUG_STATUS = ['New', 'Confirmed', 'In progress', 'Fixed in build', 'Verified', 'Closed', "Won't fix"];
const TASK_STATUS = ['Backlog', 'To do', 'In progress', 'Waiting for Ahmed', 'Waiting for Shady', 'Done'];
const s = (description: string) => ({ type: 'string', description });
const e = (values: string[], description: string) => ({ type: 'string', enum: values, description });

const TOOLS = [
  {
    name: 'list_items',
    description: 'List bugs and tasks (newest activity first). All filters are optional. Returns a short row per item with its number.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: e(['bug', 'task'], 'Only bugs or only tasks'),
        status: s(`Exact status. Bugs: ${BUG_STATUS.join(', ')}. Tasks: ${TASK_STATUS.join(', ')}.`),
        owner: e(ENUMS.owner, 'Task owner'),
        severity: e(ENUMS.severity, 'Bug severity'),
        area: e(ENUMS.area, 'Area of the product'),
        open_only: { type: 'boolean', description: 'Hide Closed, Won\'t fix and Done items' },
        mine: { type: 'boolean', description: 'Only items owned by me or waiting for me' },
        query: s('Words in the title, or a number like #12, or a Linear code like BES-5'),
        limit: { type: 'integer', description: 'Max rows, default 25, max 50' },
      },
    },
  },
  {
    name: 'get_item',
    description: 'Open one bug or task by number: all fields, comments, screenshots (with temporary links), the history, and linked items.',
    inputSchema: { type: 'object', properties: { number: { type: 'integer', description: 'The item number, for example 12 for #12' } }, required: ['number'] },
  },
  {
    name: 'create_bug',
    description: 'File a new bug. Before calling, ask the person for anything missing in steps, expected and actual: a bug without them is hard to fix. Run list_items with a query first to avoid a duplicate.',
    inputSchema: {
      type: 'object',
      properties: {
        title: s('Short clear title, up to 200 characters'),
        severity: e(ENUMS.severity, 'Blocker = app unusable or data lost; High = main feature broken; Medium = annoying but there is a workaround; Low = cosmetic'),
        platform: e(ENUMS.platform, 'Where it happens'),
        area: e(ENUMS.area, 'Which part of the product'),
        steps: s('Steps to reproduce, one per line'),
        expected: s('What should happen'),
        actual: s('What happens instead'),
        build: s('App build, for example 1.0.0 (4) TestFlight'),
        screen: s('Screen or page name'),
        linked_task: { type: 'integer', description: 'Number of the task that tracks this bug' },
      },
      required: ['title', 'severity', 'platform', 'area', 'steps', 'expected', 'actual'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task. Run list_items with a query first to avoid a duplicate.',
    inputSchema: {
      type: 'object',
      properties: {
        title: s('Short clear title, up to 200 characters'),
        owner: e(ENUMS.owner, 'Who does it'),
        priority: e(ENUMS.priority, 'Default Medium'),
        area: e(ENUMS.area, 'Which part of the product'),
        due_date: s('YYYY-MM-DD'),
        details: s('What needs doing and why'),
        task_type: s('Free label, for example Store, Design, Backend'),
      },
      required: ['title', 'owner'],
    },
  },
  {
    name: 'update_item',
    description: 'Change fields of a bug or task. Send only what changes. Status must fit the kind. Send null to clear a field.',
    inputSchema: {
      type: 'object',
      properties: {
        number: { type: 'integer' },
        status: s(`Bugs: ${BUG_STATUS.join(', ')}. Tasks: ${TASK_STATUS.join(', ')}.`),
        title: s('New title'),
        severity: e(ENUMS.severity, 'Bugs only'),
        priority: e(ENUMS.priority, 'Tasks only'),
        platform: e(ENUMS.platform, 'Platform'),
        area: e(ENUMS.area, 'Area'),
        owner: e(ENUMS.owner, 'Tasks only'),
        due_date: s('YYYY-MM-DD'),
        build: s('Build'),
        screen: s('Screen'),
        steps: s('Steps to reproduce'),
        expected: s('Expected'),
        actual: s('Actual'),
        details: s('Task details'),
        link_num: { type: 'integer', description: 'Number of the linked item' },
      },
      required: ['number'],
    },
  },
  {
    name: 'add_comment',
    description: 'Add a comment to a bug or task.',
    inputSchema: { type: 'object', properties: { number: { type: 'integer' }, body: s('The comment, up to 5000 characters') }, required: ['number', 'body'] },
  },
  {
    name: 'attach_screenshot',
    description: 'Attach a small image (screenshot) to a bug or task. Send the image as base64 text, no "data:" prefix. Keep it under about 3 MB (PNG, JPEG or WebP); for larger files, attach on the item page in the dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        number: { type: 'integer' },
        image_base64: s('Base64 of the image bytes'),
        mime: e(['image/png', 'image/jpeg', 'image/webp'], 'Image type'),
      },
      required: ['number', 'image_base64', 'mime'],
    },
  },
];

class Plain extends Error {} // a message safe to show the person

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_IMAGE = 3_000_000; // bytes

async function rpc(key: string, action: string, args: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc('team_mcp', { p_key: key, p_action: action, p_args: args });
  if (error) {
    if (error.code === '42501') throw new Plain('That key is not valid, or it was revoked, or its owner is no longer an admin. Make a new key in the dashboard under Team > Connect.');
    if (error.code === '54000') throw new Plain('Too many requests this hour. Try again later.');
    console.error('team_mcp', error.code, error.message);
    throw new Plain('The tracker could not answer. Try again.');
  }
  if (data?.error === 'not_found') throw new Plain('No item with that number.');
  if (data?.error === 'invalid') throw new Plain(`Not accepted: ${data.detail}`);
  if (data?.error) throw new Plain(`Not accepted: ${data.error}`);
  return data;
}

const pick = (o: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

const ITEM_KEYS = ['status', 'title', 'severity', 'priority', 'platform', 'area', 'owner', 'due_date', 'build', 'screen', 'steps', 'expected', 'actual', 'details', 'link_num', 'task_type'];

async function call(name: string, a: Record<string, unknown>, key: string): Promise<unknown> {
  switch (name) {
    case 'list_items': {
      const limit = Math.min(Math.max(Number(a.limit) || 25, 1), 50);
      const filters: Record<string, unknown> = { ...pick(a, ['status', 'owner', 'severity', 'area']) };
      if (a.open_only) filters.open = true;
      if (a.mine) filters.mine = true;
      if (typeof a.query === 'string' && a.query.trim()) filters.q = a.query.trim();
      const rows = await rpc(key, 'list', { kind: a.kind ?? null, filters, limit });
      return rows.map((r: Record<string, unknown>) => ({ ...r, link: `${SITE}/${r.num}` }));
    }
    case 'get_item': {
      const d = await rpc(key, 'get', { num: a.number });
      const list = await Promise.all((d.files as { path: string }[]).map(async (f) => {
        const { data } = await files.storage.from('team-files').createSignedUrl(f.path, 3600);
        return { ...f, url: data?.signedUrl ?? null };
      }));
      return { ...d, files: list, link: `${SITE}/${a.number}` };
    }
    case 'create_bug':
    case 'create_task': {
      const bug = name === 'create_bug';
      const item: Record<string, unknown> = { kind: bug ? 'bug' : 'task', ...pick(a, ITEM_KEYS) };
      if (a.linked_task) item.link_num = a.linked_task;
      if (!bug && !item.priority) item.priority = 'Medium';
      const r = await rpc(key, 'save', { item });
      return { ok: true, number: r.num, link: `${SITE}/${r.num}` };
    }
    case 'update_item': {
      const r = await rpc(key, 'save', { item: { num: a.number, ...pick(a, ITEM_KEYS) } });
      return { ok: true, number: r.num, link: `${SITE}/${r.num}` };
    }
    case 'add_comment': {
      await rpc(key, 'comment', { num: a.number, body: a.body });
      return { ok: true, link: `${SITE}/${a.number}` };
    }
    case 'attach_screenshot': {
      const mime = String(a.mime);
      if (!(mime in EXT)) throw new Plain('Only PNG, JPEG or WebP images.');
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(String(a.image_base64).replace(/\s/g, '')), (c) => c.charCodeAt(0));
      } catch {
        throw new Plain('The image is not valid base64.');
      }
      if (bytes.length > MAX_IMAGE) throw new Plain('The image is too big (limit about 3 MB). Attach it on the item page in the dashboard.');
      const d = await rpc(key, 'get', { num: a.number }); // also proves the item exists and the key is good
      const path = `${d.item.id}/${crypto.randomUUID()}.${EXT[mime]}`;
      const up = await files.storage.from('team-files').upload(path, bytes, { contentType: mime });
      if (up.error) { console.error('upload', up.error.message); throw new Plain('The image could not be stored.'); }
      await rpc(key, 'file_add', { num: a.number, path, mime, size: bytes.length });
      return { ok: true, link: `${SITE}/${a.number}` };
    }
  }
  throw new Plain('Unknown tool.');
}

const rpcOut = (id: unknown, result: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), { headers: { 'Content-Type': 'application/json' } });
const rpcErr = (id: unknown, code: number, message: string) => new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), { headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Bestim Team MCP', { status: req.method === 'GET' ? 405 : 400 });
  const key = new URL(req.url).searchParams.get('key') ?? (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '');
  const msg = await req.json().catch(() => null);
  if (!msg || typeof msg.method !== 'string') return rpcErr(null, -32700, 'bad request');
  if (msg.id === undefined) return new Response(null, { status: 202 }); // notifications need no answer

  switch (msg.method) {
    case 'initialize':
      return rpcOut(msg.id, {
        protocolVersion: msg.params?.protocolVersion ?? '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'bestim-team', version: '1.0.0' },
        instructions: 'Bestim bugs and tasks. Check for a duplicate with list_items before creating. Ask for missing steps, expected and actual before filing a bug.',
      });
    case 'ping':
      return rpcOut(msg.id, {});
    case 'tools/list':
      return rpcOut(msg.id, { tools: TOOLS });
    case 'tools/call': {
      if (!key) return rpcOut(msg.id, { isError: true, content: [{ type: 'text', text: 'No key. Add your personal key from the dashboard (Team > Connect) to the connector address.' }] });
      try {
        const out = await call(String(msg.params?.name), msg.params?.arguments ?? {}, key);
        return rpcOut(msg.id, { content: [{ type: 'text', text: JSON.stringify(out) }] });
      } catch (err) {
        const text = err instanceof Plain ? err.message : 'Something went wrong.';
        if (!(err instanceof Plain)) console.error(err);
        return rpcOut(msg.id, { isError: true, content: [{ type: 'text', text }] });
      }
    }
  }
  return rpcErr(msg.id, -32601, 'method not found');
});
