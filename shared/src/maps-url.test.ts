import { describe, expect, it } from 'vitest';
import { extractFirstUrl, ftidToCid, isGoogleMapsUrl, isShortMapsUrl, parseMapsUrl } from './maps-url';
import { classifyLink, mapsDirectionsUrl } from './links';
import { estimateLeg, haversineM } from './estimate';

describe('isGoogleMapsUrl / isShortMapsUrl', () => {
  it.each([
    ['https://maps.app.goo.gl/AbCdEf123', true, true],
    ['https://goo.gl/maps/xyz', true, true],
    ['https://share.google/abc', true, true],
    ['https://www.google.com/maps/place/Fushimi+Inari/@34.9,135.7,17z', true, false],
    ['https://www.google.co.jp/maps/place/X', true, false],
    ['https://maps.google.com/?q=34.6,135.5', true, false],
    ['https://www.google.com/?cid=123', true, false],
    ['https://www.google.com/search?q=osaka', false, false],
    ['https://goo.gl/other', false, false],
    ['not a url', false, false],
  ])('%s', (url, isMaps, isShort) => {
    expect(isGoogleMapsUrl(url)).toBe(isMaps);
    expect(isShortMapsUrl(url)).toBe(isShort);
  });
});

describe('extractFirstUrl', () => {
  it('pulls the URL out of share text', () => {
    expect(extractFirstUrl('伏見稻荷大社\nhttps://maps.app.goo.gl/q1w2e3 ')).toBe('https://maps.app.goo.gl/q1w2e3');
    expect(extractFirstUrl('no link')).toBeNull();
  });
});

describe('parseMapsUrl', () => {
  it('reads name, pin coordinates and ftid from a place URL', () => {
    const url =
      'https://www.google.com/maps/place/%E4%BC%8F%E8%A6%8B%E7%A8%B2%E8%8D%B7%E5%A4%A7%E7%A4%BE/@34.9671,135.7700,17z/data=!3m1!4b1!4m6!3m5!1s0x60010f153d2e6d21:0x7b1aca1c753ae2e9!8m2!3d34.9676945!4d135.7791876!16zL20vMDNoZnk1?entry=ttu';
    const p = parseMapsUrl(url);
    expect(p.name).toBe('伏見稲荷大社');
    expect(p.location).toEqual({ lat: 34.9676945, lng: 135.7791876 });
    expect(p.ftid).toBe('0x60010f153d2e6d21:0x7b1aca1c753ae2e9');
    expect(p.cid).toBe(BigInt('0x7b1aca1c753ae2e9').toString());
  });

  it('falls back to the @ viewport when there is no pin', () => {
    const p = parseMapsUrl('https://www.google.com/maps/place/Shinsekai/@34.6525,135.5063,16z');
    expect(p.name).toBe('Shinsekai');
    expect(p.location).toEqual({ lat: 34.6525, lng: 135.5063 });
  });

  it('handles api=1 search URLs with a place id', () => {
    const p = parseMapsUrl(
      'https://www.google.com/maps/search/?api=1&query=Universal+Studios+Japan&query_place_id=ChIJxxxxxxxx',
    );
    expect(p.placeId).toBe('ChIJxxxxxxxx');
    expect(p.name).toBe('Universal Studios Japan');
  });

  it('handles ?q= with coordinates and with place_id:', () => {
    expect(parseMapsUrl('https://maps.google.com/?q=34.6466,135.5133').location).toEqual({
      lat: 34.6466,
      lng: 135.5133,
    });
    expect(parseMapsUrl('https://maps.google.com/?q=place_id:ChIJabc').placeId).toBe('ChIJabc');
  });

  it('handles ?cid=', () => {
    expect(parseMapsUrl('https://maps.google.com/?cid=8871262553451634409').cid).toBe('8871262553451634409');
  });

  it('handles /maps/search/<query>', () => {
    const p = parseMapsUrl('https://www.google.com/maps/search/%E3%82%B9%E3%82%AE%E8%96%AC%E5%B1%80+%E5%A4%A9%E7%8E%8B%E5%AF%BA/@34.64,135.51,15z');
    expect(p.query).toBe('スギ薬局 天王寺');
    expect(p.name).toBe('スギ薬局 天王寺');
  });

  it('returns empty for garbage', () => {
    expect(parseMapsUrl('hello')).toEqual({});
  });

  it('ftidToCid rejects malformed input', () => {
    expect(ftidToCid('nope')).toBeUndefined();
  });
});

describe('links', () => {
  it.each([
    ['https://www.threads.com/@someone/post/abc', 'threads'],
    ['https://www.threads.net/@someone/post/abc', 'threads'],
    ['https://www.instagram.com/p/abc/', 'instagram'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.agoda.com/zh-tw/x/hotel/osaka-jp.html', 'agoda'],
    ['https://www.airbnb.com.tw/rooms/123', 'airbnb'],
    ['https://maps.app.goo.gl/abc', 'google-maps'],
    ['https://example.com', 'web'],
  ])('%s → %s', (url, kind) => {
    expect(classifyLink(url)).toBe(kind);
  });

  it('builds a directions deep link with place ids', () => {
    const url = mapsDirectionsUrl(
      { name: 'A', placeId: 'P1', location: { lat: 1, lng: 2 } },
      { name: 'B', placeId: 'P2', location: { lat: 3, lng: 4 } },
      'TRANSIT',
    );
    const u = new URL(url);
    expect(u.searchParams.get('travelmode')).toBe('transit');
    expect(u.searchParams.get('origin_place_id')).toBe('P1');
    expect(u.searchParams.get('destination')).toBe('3,4');
  });
});

describe('estimate', () => {
  const shinImamiya = { lat: 34.6496, lng: 135.5013 };
  const kyotoStation = { lat: 34.9858, lng: 135.7588 };
  it('haversine is roughly right (新今宮→京都 ≈ 44 km)', () => {
    const km = haversineM(shinImamiya, kyotoStation) / 1000;
    expect(km).toBeGreaterThan(40);
    expect(km).toBeLessThan(48);
  });
  it('transit is faster than walking for long hops, walking wins for tiny hops', () => {
    const far = { walk: estimateLeg(shinImamiya, kyotoStation, 'WALK'), rail: estimateLeg(shinImamiya, kyotoStation, 'TRANSIT') };
    expect(far.rail.durationSec).toBeLessThan(far.walk.durationSec);
    const near = { lat: 34.6505, lng: 135.5013 };
    expect(estimateLeg(shinImamiya, near, 'TRANSIT').durationSec).toBe(estimateLeg(shinImamiya, near, 'WALK').durationSec);
  });
  it('rail estimates are in a realistic range', () => {
    const min = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => estimateLeg(a, b, 'TRANSIT').durationSec / 60;
    const fushimiInari = { lat: 34.9671, lng: 135.7727 };
    const shinOsaka = { lat: 34.7334, lng: 135.5001 };
    const tokyo = { lat: 35.6812, lng: 139.7671 };
    // JR via Osaka/Kyoto ≈ 55–70 min in reality.
    expect(min(shinImamiya, fushimiInari)).toBeGreaterThan(55);
    expect(min(shinImamiya, fushimiInari)).toBeLessThan(85);
    // Hikari 新大阪→東京 ≈ 2h55.
    expect(min(shinOsaka, tokyo)).toBeGreaterThan(150);
    expect(min(shinOsaka, tokyo)).toBeLessThan(210);
  });
});
