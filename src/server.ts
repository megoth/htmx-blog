import express from 'express';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

type BlogEntry = {
  title: string;
  content: string;
  publishedDate: string;
};

const entries: BlogEntry[] = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, 'templates');

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderEntriesHtml(items: BlogEntry[]): string {
  if (items.length === 0) {
    return '<p>No blog entries yet.</p>';
  }

  const rendered = items
    .map(
      (entry) => `<article>
  <h2>${escapeHtml(entry.title)}</h2>
  <p>${escapeHtml(entry.content)}</p>
  <small>Published: ${escapeHtml(entry.publishedDate)}</small>
</article>`
    )
    .join('\n<hr />\n');

  return `<section>${rendered}</section>`;
}

async function loadTemplate(name: 'list' | 'create'): Promise<string> {
  return readFile(path.join(templatesDir, `${name}.html`), 'utf8');
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  });

  app.use(vite.middlewares);

  app.get('/', async (_req, res, next) => {
    try {
      const template = await loadTemplate('list');
      const html = await vite.transformIndexHtml('/', template);
      res.status(200).type('html').send(html);
    } catch (error) {
      next(error);
    }
  });

  app.get('/create', async (_req, res, next) => {
    try {
      const template = await loadTemplate('create');
      const html = await vite.transformIndexHtml('/create', template);
      res.status(200).type('html').send(html);
    } catch (error) {
      next(error);
    }
  });

  app.get('/entries', (_req, res) => {
    res.status(200).type('html').send(renderEntriesHtml(entries));
  });

  app.post('/api/entries', (req, res) => {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';

    if (!title || !content) {
      res.status(400).type('html').send('<p>Title and content are required.</p>');
      return;
    }

    entries.unshift({
      title,
      content,
      publishedDate: new Date().toISOString()
    });

    res
      .status(201)
      .type('html')
      .send('<p>Entry created successfully. <a href="/">Go to list</a></p>');
  });

  const port = Number(process.env.PORT ?? 5173);
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

void startServer();
