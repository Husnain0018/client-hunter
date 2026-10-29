import { describe, expect, it } from 'vitest';
import { normalizeAndDedupe, type MapsPlace } from '../src/services/mapsScraper.js';

const place = (overrides: Partial<MapsPlace> = {}): MapsPlace => ({ placeId: '1', title: 'Example Clinic', category: 'Dentist', address: 'Lahore', country: 'Pakistan', phone: '+923001234567', website: '', rating: 4.5, reviews: 20, mapsUrl: '', imageUrl: '', social: {}, ...overrides });

describe('maps normalization', () => {
  it('filters government listings and de-duplicates phone/domain matches', () => {
    const result = normalizeAndDedupe([place(), place({ placeId: '2', title: 'Duplicate Clinic' }), place({ placeId: '3', title: 'Police Office', category: 'Police' })], { userName: 'A', company: 'A', userEmail: 'a@example.com', services: ['SEO'], niche: 'Dentists', area: 'Lahore', country: 'Pakistan', maxLeads: 10, checkSocial: false, emailSummary: false }, { ids: new Set(), domains: new Set(), phones: new Set() });
    expect(result.places).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.duplicates).toBe(1);
  });

  it('strictly verifies target area and excludes location mismatches', () => {
    const validLocality = place({
      placeId: 'loc-1',
      title: 'Smile Dental Clinic',
      address: 'Main Market, Peoples Colony, Gujranwala',
      phone: '+923001111111',
    });
    const differentNeighborhood = place({
      placeId: 'loc-2',
      title: 'Satellite Dental Care',
      address: 'Opposite College, Satellite Town, Gujranwala',
      phone: '+923002222222',
    });
    const differentCity = place({
      placeId: 'loc-3',
      title: 'Lahore Dental Surgery',
      address: 'Mall Road, Lahore',
      phone: '+923003333333',
    });

    const request = {
      userName: 'Ali',
      company: 'Hunter',
      userEmail: 'ali@example.com',
      services: ['SEO'],
      niche: 'Dental Clinics',
      area: 'Peoples Colony, Gujranwala',
      country: 'Pakistan',
      maxLeads: 10,
      checkSocial: false,
      emailSummary: false,
    };

    const result = normalizeAndDedupe([validLocality, differentNeighborhood, differentCity], request, { ids: new Set(), domains: new Set(), phones: new Set() });
    expect(result.places).toHaveLength(1);
    expect(result.places[0].placeId).toBeDefined();
    expect(result.places[0].locationVerified).toBe(true);
    expect(result.places[0].locationStatus).toBe('Verified');
    expect(result.skipped).toBe(2); // Both the different neighborhood and different city excluded
  });
});
