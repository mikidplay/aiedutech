// scripts/fetch-news.mjs
// RSS를 읽어 docs/data/news.json 생성

import fs from 'node:fs/promises';
import path from 'node:path';
import Parser from 'rss-parser';

const parser = new Parser({
  headers: { 'User-Agent': 'aiedutech-news-bot/1.0' },
  timeout: 20000 // 20s
});

// 원하는 피드를 여기에 추가/수정하세요.
const feeds = {
  domestic: [
    { name: "Google News KR Top", url: "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko" },
    { name: "Google News KR Tech", url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko" }
  ],
  overseas: [
    { name: "Google News World (KR)", url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=ko&gl=KR&ceid=KR:ko" },
    { name: "The Guardian World", url: "https://www.theguardian.com/world/rss" }
  ]
};

function unwrapGoogleNewsLink(link) {
  try {
    const u = new URL(link);
    if (u.hostname === 'news.google.com') {
      // news.google.com 링크 안의 원문 링크를 빼내기
      const p = u.searchParams.get('url');
      if (p) return decodeURIComponent(p);
      const m = link.match(/https?:\/\/news\.google\.com\/.*?(https?:\/\/[^&]+)/);
      if (m) return m[1];
    }
  } catch { /* ignore */ }
  return link;
}

function normalizeItem(it, group, sourceName) {
  const title = (it.title || '').trim();
  const link = unwrapGoogleNewsLink(it.link || '');
  const publishedAt = it.isoDate || it.pubDate || null;
  return { group, source: sourceName, title, link, publishedAt };
}

function dedupe(items) {
  const seen = new Set();
  return items.filter(x => {
    const key = (x.link || x.title).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const out = { generatedAt: new Date().toISOString(), items: [] };

  for (const [group, list] of Object.entries(feeds)) {
    for (const f of list) {
      try {
        const feed = await parser.parseURL(f.url);
        const entries = (feed.items || [])
          .slice(0, 30)
          .map(it => normalizeItem(it, group, f.name));
        out.items.push(...entries);
      } catch (e) {
        console.error(`[feed error] ${f.url} → ${e.message}`);
      }
    }
  }

  out.items = dedupe(out.items)
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

  const outDir = path.join("docs", "data");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "news.json"),
    JSON.stringify(out, null, 2),
    "utf-8"
  );

  console.log(`Wrote ${out.items.length} items at ${out.generatedAt}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
