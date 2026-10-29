import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import type { Competitor, LocationStatus, SearchRequest } from '../types/domain.js';

export interface MapsPlace {
  placeId: string;
  title: string;
  category: string;
  address: string;
  country: string;
  phone: string;
  website: string;
  rating: number | string;
  reviews: number;
  mapsUrl: string;
  imageUrl: string;
  social: Record<string, string>;
  locationStatus?: LocationStatus;
  locationVerified?: boolean;
}

export interface LocationTarget {
  rawArea: string;
  country: string;
  locality?: string;
  city: string;
}

export function parseLocationTarget(area: string, country: string): LocationTarget {
  const cleanArea = area.replace(/\s+/g, ' ').trim();
  const parts = cleanArea.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      rawArea: cleanArea,
      country: country.trim(),
      locality: parts.slice(0, -1).join(' ').toLowerCase(),
      city: parts[parts.length - 1].toLowerCase(),
    };
  }
  // If no comma, check if there are multiple words (e.g. "peoples colony gujranwala")
  const words = cleanArea.split(' ');
  if (words.length >= 3) {
    const potentialCity = words[words.length - 1].toLowerCase();
    const potentialLocality = words.slice(0, -1).join(' ').toLowerCase();
    return {
      rawArea: cleanArea,
      country: country.trim(),
      locality: potentialLocality,
      city: potentialCity,
    };
  }
  return {
    rawArea: cleanArea,
    country: country.trim(),
    city: cleanArea.toLowerCase(),
  };
}

function normalizeForComparison(val: string): string {
  return val.toLowerCase().replace(/['"`]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function verifyPlaceLocation(place: MapsPlace, target: LocationTarget): { verified: boolean; status: LocationStatus; reason?: string } {
  const normAddress = normalizeForComparison(place.address);
  const normTitle = normalizeForComparison(place.title);
  const combined = `${normAddress} ${normTitle}`;
  const targetCityNorm = normalizeForComparison(target.city);

  // If a distinct country is specified, check country mismatch
  if (target.country && place.country) {
    const normTargetCountry = normalizeForComparison(target.country);
    const normPlaceCountry = normalizeForComparison(place.country);
    if (normPlaceCountry && !normPlaceCountry.includes(normTargetCountry) && !combined.includes(normTargetCountry)) {
      return { verified: false, status: 'Mismatch', reason: `Country mismatch: ${place.country} != ${target.country}` };
    }
  }

  // Check if city matches
  const hasCityMatch = combined.includes(targetCityNorm);

  // Common distinct Pakistani cities to detect clear city mismatches when searching Gujranwala, Lahore, etc.
  const commonCities = ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'gujranwala', 'multan', 'peshawar', 'quetta', 'sialkot', 'gujrat', 'sheikhupura', 'sargodha', 'bahawalpur'];
  for (const c of commonCities) {
    if (c !== targetCityNorm && combined.includes(c) && !hasCityMatch) {
      return { verified: false, status: 'Mismatch', reason: `Belongs to different city: ${c}` };
    }
  }

  // If no locality was targeted, matching city is sufficient
  if (!target.locality) {
    if (hasCityMatch || !normAddress) {
      return { verified: true, status: 'Verified' };
    }
    return { verified: false, status: 'Mismatch', reason: 'City not found in address' };
  }

  // Locality targeting (e.g. "Peoples Colony")
  const targetLocalityNorm = normalizeForComparison(target.locality);
  const hasLocalityMatch = combined.includes(targetLocalityNorm);

  if (hasLocalityMatch) {
    return { verified: true, status: 'Verified' };
  }

  // Check if address explicitly contains a conflicting locality/area in the same city
  const knownConflictingLocalities = [
    'satellite town', 'model town', 'civil lines', 'cantonment', 'cantt', 'wapda town',
    'dc colony', 'master city', 'garden town', 'shaheenabad', 'climax town', 'rahwali',
    'faisal town', 'gulshan', 'gulberg', 'johar town', 'dha', 'bahria town', 'sadar bazar'
  ];

  for (const loc of knownConflictingLocalities) {
    if (loc !== targetLocalityNorm && !targetLocalityNorm.includes(loc) && combined.includes(loc)) {
      return { verified: false, status: 'Mismatch', reason: `Belongs to different neighborhood: ${loc}` };
    }
  }

  // If it matched the city but locality wasn't confirmed
  if (hasCityMatch) {
    return { verified: false, status: 'City Match (Unverified Locality)', reason: `Located in ${target.city}, but exact match for ${target.locality} could not be verified in address.` };
  }

  return { verified: false, status: 'Mismatch', reason: `Target area ${target.rawArea} not found in listing.` };
}

function stableId(value: string): string {
  return `L${createHash('sha256').update(value).digest('hex').slice(0, 20)}`;
}

function host(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function isDirectoryOrSocial(value: string): boolean {
  const h = host(value);
  return ['facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'youtube.com', 'tiktok.com', 'linktr.ee', 'wa.me', 'google.com', 'business.site', 'yelp.com', 'tripadvisor.com', 'foursquare.com', 'yellowpages.com', 'oladoc.com', 'marham.pk', 'justdial.com'].some((domain) => h === domain || h.endsWith(`.${domain}`));
}

function fallbackPlaces(request: SearchRequest): MapsPlace[] {
  const base = request.niche.replace(/\s+/g, ' ').trim() || 'Dental Clinic';
  const target = parseLocationTarget(request.area, request.country);
  const capitalize = (s: string) => s.split(' ').map((w) => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '').join(' ');
  const localityName = target.locality ? capitalize(target.locality) : '';
  const cityName = capitalize(target.city);
  const areaLabel = localityName ? `${localityName}, ${cityName}` : cityName;

  return Array.from({ length: Math.min(request.maxLeads * 2, 30) }, (_, index) => {
    const ordinal = index + 1;
    const name = localityName ? `${localityName} ${base} ${ordinal}` : `${cityName} ${base} ${ordinal}`;
    const phone = request.country.toLowerCase().includes('pakistan') ? `+92 300 ${String(1000000 + ordinal).slice(-7)}` : '';
    const address = localityName ? `Plot ${10 + ordinal}, Main Boulevard, ${localityName}, ${cityName}, ${request.country}` : `Building ${ordinal}, Central Road, ${cityName}, ${request.country}`;
    return {
      placeId: `fallback-${stableId(`${name}|${areaLabel}|${request.country}`)}`,
      title: name,
      category: request.niche,
      address,
      country: request.country,
      phone,
      website: ordinal % 2 === 0 ? `https://www.${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.pk` : '',
      rating: (4.1 + ((ordinal * 7) % 8) / 10).toFixed(1),
      reviews: 12 + ordinal * 17,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${areaLabel}, ${request.country}`)}`,
      imageUrl: '',
      social: {},
      locationVerified: true,
      locationStatus: 'Verified' as LocationStatus,
    };
  });
}

function parsePlace(raw: Record<string, unknown>, request: SearchRequest): MapsPlace | null {
  const title = String(raw.title ?? raw.name ?? '').trim();
  if (!title) return null;
  const websiteRaw = String(raw.website ?? raw.url ?? '').trim();
  const website = websiteRaw && !isDirectoryOrSocial(websiteRaw) ? (/^https?:\/\//i.test(websiteRaw) ? websiteRaw : `https://${websiteRaw}`) : '';
  const social: Record<string, string> = {};
  if (websiteRaw && isDirectoryOrSocial(websiteRaw)) social.website = websiteRaw;
  const rating = typeof raw.totalScore === 'number' || typeof raw.totalScore === 'string' ? raw.totalScore as number | string : '';
  const reviews = Number(raw.reviewsCount ?? raw.reviewCount ?? 0) || 0;
  const address = String(raw.address ?? raw.street ?? '').trim();
  const phone = String(raw.phone ?? raw.phoneUnformatted ?? '').trim();
  const placeId = String(raw.placeId ?? raw.cid ?? '').trim() || `${title}|${address}`;
  return { placeId, title, category: String(raw.categoryName ?? request.niche), address, country: request.country, phone, website, rating, reviews, mapsUrl: String(raw.url ?? raw.googleMapsUrl ?? ''), imageUrl: String(raw.imageUrl ?? ''), social };
}

export async function searchMaps(request: SearchRequest): Promise<{ places: MapsPlace[]; source: 'apify' | 'fallback'; warning?: string }> {
  if (!env.APIFY_API_TOKEN) return { places: fallbackPlaces(request), source: 'fallback', warning: 'Apify is not configured; local deterministic discovery data was used.' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const target = parseLocationTarget(request.area, request.country);
    const searchString = target.locality ? `${request.niche} ${target.locality} ${target.city}` : `${request.niche} ${target.city}`;
    const response = await fetch('https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.APIFY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: [searchString, `${request.niche} in ${request.area}`],
        locationQuery: `${request.area}, ${request.country}`,
        maxCrawledPlacesPerSearch: Math.min(Math.ceil(request.maxLeads * 2), 150),
        language: 'en',
        skipClosedPlaces: true,
        website: 'allPlaces',
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Google Maps provider returned HTTP ${response.status}.`);
    const body = await response.json() as unknown;
    const rows = Array.isArray(body) ? body : [];
    const places = rows.map((row) => parsePlace((row ?? {}) as Record<string, unknown>, request)).filter((row): row is MapsPlace => Boolean(row));
    return { places, source: 'apify' };
  } catch (error) {
    return { places: fallbackPlaces(request), source: 'fallback', warning: `Apify was unavailable (${error instanceof Error ? error.message : 'unknown error'}); deterministic fallback data was used.` };
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeAndDedupe(
  places: MapsPlace[],
  request: SearchRequest,
  seen: { ids: Set<string>; domains: Set<string>; phones: Set<string>; names?: Set<string> }
): { places: MapsPlace[]; duplicates: number; skipped: number; competitors: Map<string, Competitor[]> } {
  const batch = new Set<string>();
  const clean: MapsPlace[] = [];
  let duplicates = 0;
  let skipped = 0;
  const target = parseLocationTarget(request.area, request.country);
  const government = /\b(government|municipal|police|city hall|town hall|courthouse|ministry|army|military|cantonment|nadra|wapda|public library|civil hospital|post office|fire station)\b/i;
  const govHost = /(^|\.)((gov|mil|govt|nic|admin)\.[a-z]{2,}|gov)$/i;

  for (const place of places) {
    const text = `${place.title} ${place.category} ${place.address}`;
    const websiteHost = host(place.website);
    if (government.test(text) || govHost.test(websiteHost)) {
      skipped += 1;
      continue;
    }

    // Strict location verification
    const loc = verifyPlaceLocation(place, target);
    if (loc.status === 'Mismatch') {
      skipped += 1;
      continue;
    }

    const id = stableId(place.placeId || `${place.title}|${place.address}`);
    const domain = websiteHost;
    const phone = place.phone.replace(/\D/g, '').slice(-9);
    const normName = normalizeForComparison(place.title);

    const isDuplicate =
      batch.has(`id:${id}`) ||
      (domain && batch.has(`domain:${domain}`)) ||
      (phone && batch.has(`phone:${phone}`)) ||
      seen.ids.has(id) ||
      (domain && seen.domains.has(domain)) ||
      (phone && seen.phones.has(phone)) ||
      (normName && seen.names && seen.names.has(normName));

    if (isDuplicate) {
      duplicates += 1;
      continue;
    }

    if (!place.website && !place.phone && !Object.keys(place.social).length) {
      skipped += 1;
      continue;
    }

    batch.add(`id:${id}`);
    if (domain) batch.add(`domain:${domain}`);
    if (phone) batch.add(`phone:${phone}`);
    clean.push({
      ...place,
      placeId: id,
      locationVerified: loc.verified,
      locationStatus: loc.status,
    });

    if (clean.length >= request.maxLeads) break;
  }

  const competitors = new Map<string, Competitor[]>();
  for (const place of clean) {
    competitors.set(
      place.placeId,
      clean
        .filter((other) => other.placeId !== place.placeId)
        .sort((a, b) => b.reviews - a.reviews)
        .slice(0, 3)
        .map((other) => ({ name: other.title, rating: other.rating, reviews: other.reviews, hasWebsite: Boolean(other.website), website: other.website }))
    );
  }
  return { places: clean, duplicates, skipped, competitors };
}
