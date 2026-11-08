import { describe, expect, it } from 'vitest';
import { ListingDetailsInput, ReportInput, SaveInput, UploadRequest } from './sell';

const base = {
  listingId: '3f1c2b9a-6d4e-4f7a-9b2c-1e8d7a6b5c4d',
  title: '  Walnut   desk ',
  categorySlug: 'furniture',
  condition: 'good',
  free: false,
  priceDollars: 120,
  attributes: { material: 'Wood' },
  description: 'Solid.\r\nNo drawers.\u0007',
  pickupZip: '97205',
};

describe('sell inputs', () => {
  it('normalizes title and description to plain text', () => {
    const parsed = ListingDetailsInput.parse(base);
    expect(parsed.title).toBe('Walnut desk');
    expect(parsed.description).toBe('Solid.\nNo drawers.');
  });

  it('Free forces $0', () => {
    expect(ListingDetailsInput.parse({ ...base, free: true }).priceDollars).toBe(0);
  });

  it('rejects cents, negative and huge prices, long titles and unknown keys', () => {
    expect(ListingDetailsInput.safeParse({ ...base, priceDollars: 12.5 }).success).toBe(false);
    expect(ListingDetailsInput.safeParse({ ...base, priceDollars: -1 }).success).toBe(false);
    expect(ListingDetailsInput.safeParse({ ...base, priceDollars: 100_001 }).success).toBe(false);
    expect(ListingDetailsInput.safeParse({ ...base, title: 'x'.repeat(81) }).success).toBe(false);
    expect(ListingDetailsInput.safeParse({ ...base, title: '   ' }).success).toBe(false);
    expect(ListingDetailsInput.safeParse({ ...base, description: 'x'.repeat(2001) }).success).toBe(
      false,
    );
    expect(ListingDetailsInput.safeParse({ ...base, sellerId: 'x' }).success).toBe(false);
  });

  it('only accepts the supported video types', () => {
    const upload = {
      listingId: base.listingId,
      type: 'video/mp4',
      sizeBytes: 10,
      durationSeconds: 5,
    };
    expect(UploadRequest.safeParse(upload).success).toBe(true);
    expect(UploadRequest.safeParse({ ...upload, type: 'image/gif' }).success).toBe(false);
  });

  it('reports take a known reason and a short plain note', () => {
    const report = { targetType: 'listing', targetId: base.listingId, reason: 'scam', note: '' };
    expect(ReportInput.safeParse(report).success).toBe(true);
    expect(ReportInput.safeParse({ ...report, reason: 'meh' }).success).toBe(false);
    expect(ReportInput.safeParse({ ...report, note: 'x'.repeat(501) }).success).toBe(false);
  });

  it('profile reports name a valid @handle, never an id', () => {
    const report = { targetType: 'profile', handle: '@Sam.Rivera', reason: 'harassment', note: '' };
    const parsed = ReportInput.safeParse(report);
    expect(parsed.success && parsed.data.targetType === 'profile' && parsed.data.handle).toBe(
      'sam.rivera',
    );
    expect(ReportInput.safeParse({ ...report, handle: 'admin' }).success).toBe(false);
    expect(
      ReportInput.safeParse({ ...report, handle: undefined, targetId: base.listingId }).success,
    ).toBe(false);
  });

  it('save toggles take a listing id and a boolean', () => {
    expect(SaveInput.safeParse({ listingId: base.listingId, saved: true }).success).toBe(true);
    expect(SaveInput.safeParse({ listingId: 'x', saved: true }).success).toBe(false);
    expect(SaveInput.safeParse({ listingId: base.listingId, saved: 'yes' }).success).toBe(false);
  });
});
