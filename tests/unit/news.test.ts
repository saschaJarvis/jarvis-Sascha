import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeNews, parseFeed, timeAgo } from '../../src/lib/news';

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
<item><title>Werder holt Stürmer &amp; Co. - kicker</title><link>https://news.google.com/rss/articles/a1</link><guid>g1</guid>
<pubDate>Sun, 25 Oct 2026 08:00:00 GMT</pubDate><description>&lt;a href="#"&gt;Werder holt Stürmer &amp;amp; Co.&lt;/a&gt;&amp;nbsp;&lt;font&gt;kicker&lt;/font&gt;</description><source url="https://www.kicker.de">kicker</source></item>
<item><title>Ohne Link</title><link>javascript:alert(1)</link><pubDate>Sun, 25 Oct 2026 09:00:00 GMT</pubDate></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<entry><id>yt:video:XyZ_12345ab</id><yt:videoId>XyZ_12345ab</yt:videoId><title>Pressekonferenz vor dem Spiel</title>
<link rel="alternate" href="https://www.youtube.com/watch?v=XyZ_12345ab"/><author><name>SV Werder Bremen</name></author>
<published>2026-10-25T07:00:00+00:00</published><media:group><media:description>Die PK in voller Länge.</media:description></media:group></entry></feed>`;

test('RSS (Google News): Titel ohne Quellen-Anhang, Entities, Quelle', () => {
  const [a] = parseFeed(RSS, 'kicker');
  assert.equal(a.title, 'Werder holt Stürmer & Co.');
  assert.equal(a.publisher, 'kicker');
  assert.equal(a.snippet, null); // Beschreibung wiederholt nur den Titel
  assert.equal(a.date?.toISOString(), '2026-10-25T08:00:00.000Z');
});

test('Atom (YouTube): Video-Link, Vorschaubild nur von i.ytimg.com', () => {
  const [v] = parseFeed(ATOM, 'youtube');
  assert.equal(v.link, 'https://www.youtube.com/watch?v=XyZ_12345ab');
  assert.equal(v.thumb, 'https://i.ytimg.com/vi/XyZ_12345ab/mqdefault.jpg');
  assert.equal(v.snippet, 'Die PK in voller Länge.');
});

test('Zusammenführen: unsichere Links raus, Dubletten raus, neueste zuerst', () => {
  const rss = parseFeed(RSS, 'kicker');
  const dup = parseFeed(RSS.replace('- kicker', '- BILD').replace('<source url="https://www.kicker.de">kicker</source>', '<source url="https://www.bild.de">BILD</source>'), 'bild');
  const all = mergeNews([rss, dup, parseFeed(ATOM, 'youtube')]);
  assert.equal(all.some((i) => i.link.startsWith('javascript')), false);
  assert.equal(all.filter((i) => i.title === 'Werder holt Stürmer & Co.').length, 1);
  assert.equal(all[0].sourceKey, 'kicker'); // 08:00 > 07:00
  assert.equal(timeAgo(new Date('2026-10-25T08:00:00Z'), new Date('2026-10-25T10:10:00Z')), 'vor 2 Std.');
});

test('Themen: Werder zuerst, alle Quellen-Schlüssel eindeutig, Verlags-Domains streng geprüft', async () => {
  const { TOPICS, isDomain } = await import('../../src/lib/news');
  assert.equal(TOPICS[0].key, 'werder');
  assert.deepEqual(TOPICS.map((t) => t.key), ['werder', 'dubai', 'immobilien', 'bundesliga']);
  const keys = TOPICS.flatMap((t) => t.sources.map((s) => s.key));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(isDomain('gulfnews.com') && isDomain('sport.bild.de'));
  for (const bad of ['localhost', '169.254.169.254/x', 'a b.com', '..', 'x.com/../y', 'evil.com?x=1']) assert.equal(isDomain(bad), false, bad);
  const [a] = parseFeed(RSS, 'kicker');
  assert.equal(a.publisherDomain, 'kicker.de');
});
