import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCalendarUrl, parseIcs } from '../../src/lib/ics';
import { buildCalendar } from '../../src/lib/calendar';

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//iCloud//EN
BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
DTSTART:19810329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
TZNAME:MESZ
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
DTSTART:19961027T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
TZNAME:MEZ
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:einmal-1
DTSTART;TZID=Europe/Berlin:20261027T100000
DTEND;TZID=Europe/Berlin:20261027T110000
SUMMARY:Steuerberater Mainz
LOCATION:Kanzlei Müller
END:VEVENT
BEGIN:VEVENT
UID:woechentlich-1
DTSTART:20261019T060000Z
DTEND:20261019T063000Z
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=10
SUMMARY:Gym
END:VEVENT
BEGIN:VEVENT
UID:woechentlich-1
RECURRENCE-ID:20261102T060000Z
DTSTART:20261102T080000Z
DTEND:20261102T083000Z
SUMMARY:Gym (verschoben)
END:VEVENT
BEGIN:VEVENT
UID:ganztag-1
DTSTART;VALUE=DATE:20261029
DTEND;VALUE=DATE:20261031
SUMMARY:Umzugsfirma Besichtigung
END:VEVENT
BEGIN:VEVENT
UID:abgesagt-1
STATUS:CANCELLED
DTSTART:20261028T100000Z
SUMMARY:Fällt aus
END:VEVENT
END:VCALENDAR`;

const from = new Date('2026-10-19T00:00:00Z');
const to = new Date('2026-11-08T00:00:00Z');

test('ICS: Zeitzone Europe/Berlin korrekt (nach Zeitumstellung = UTC+1)', () => {
  const ev = parseIcs(ICS, from, to).find((e) => e.uid === 'einmal-1')!;
  assert.equal(ev.start.toISOString(), '2026-10-27T09:00:00.000Z');
  assert.equal(ev.location, 'Kanzlei Müller');
});

test('ICS: Wiederholung mit verschobener Ausnahme, abgesagte Termine fehlen', () => {
  const ev = parseIcs(ICS, from, to);
  const gym = ev.filter((e) => e.uid === 'woechentlich-1');
  assert.deepEqual(gym.map((g) => g.start.toISOString()), ['2026-10-19T06:00:00.000Z', '2026-10-26T06:00:00.000Z', '2026-11-02T08:00:00.000Z']);
  assert.equal(gym[2].title, 'Gym (verschoben)');
  assert.equal(ev.some((e) => e.title === 'Fällt aus'), false);
});

test('ICS: ganztägig über 2 Tage erscheint an beiden Tagen im Kalender (Dubai)', () => {
  const ev = parseIcs(ICS, from, to);
  const weeks = buildCalendar([], 'Asia/Dubai', new Date('2026-10-25T08:00:00Z'), 0, 1, ev.map((e) => ({ ...e, source: 'Privat' })));
  const w = weeks.find((x) => x.offset === 1)!;
  const thu = w.days[3], fri = w.days[4], sat = w.days[5];
  assert.equal(thu.items.some((i) => i.title === 'Umzugsfirma Besichtigung' && i.kind === 'event' && i.time === null), true);
  assert.equal(fri.items.some((i) => i.title === 'Umzugsfirma Besichtigung'), true);
  assert.equal(sat.items.some((i) => i.title === 'Umzugsfirma Besichtigung'), false);
  const tue = w.days[1].items.find((i) => i.title === 'Steuerberater Mainz')!;
  assert.equal(tue.time, '13:00'); // 10:00 Mainz = 13:00 Dubai
  assert.equal(tue.endTime, '14:00');
});

test('Kalender-Links: nur bekannte Anbieter, webcal wird zu https', () => {
  const ok = normalizeCalendarUrl('webcal://p52-caldav.icloud.com/published/2/MTIzNDU2');
  assert.deepEqual(ok, { url: 'https://p52-caldav.icloud.com/published/2/MTIzNDU2', provider: 'icloud' });
  assert.ok('error' in normalizeCalendarUrl('https://evil.example.com/cal.ics'));
  assert.ok('error' in normalizeCalendarUrl('http://p52-caldav.icloud.com/x'));
  assert.ok('error' in normalizeCalendarUrl('https://user:pw@calendar.google.com/calendar/ical/x/basic.ics'));
  assert.ok('error' in normalizeCalendarUrl('https://169.254.169.254/latest'));
  assert.equal((normalizeCalendarUrl('https://calendar.google.com/calendar/ical/abc/private-xyz/basic.ics') as { provider: string }).provider, 'google');
});
