import { describe, expect, it } from 'vitest';
import type { CategoryRow } from './taxonomy';
import {
  AttributeFilter,
  CategoryAttributes,
  buildTaxonomy,
  filtersFor,
  listingAttributesSchema,
  navDepartments,
} from './taxonomy';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const rows: CategoryRow[] = [
  {
    id: uuid(1),
    slug: 'electronics',
    parent_id: null,
    name: 'Electronics',
    sort: 1,
    nav_rank: 1,
    nav_label: null,
    hero_key: 'electronics',
    attributes: {
      filters: [
        { key: 'brand', label: 'Brand', type: 'text' },
        {
          key: 'storage_gb',
          label: 'Storage',
          type: 'enum',
          unit: 'GB',
          options: [64, 128],
          applies_to: ['phones-tablets'],
        },
      ],
    },
  },
  {
    id: uuid(2),
    slug: 'tools',
    parent_id: null,
    name: 'Tools & Home Improvement',
    sort: 2,
    nav_rank: null,
    nav_label: 'Tools',
    hero_key: 'tools',
    attributes: { filters: [] },
  },
  {
    id: uuid(11),
    slug: 'gaming',
    parent_id: uuid(1),
    name: 'Gaming',
    sort: 2,
    nav_rank: null,
    nav_label: null,
    hero_key: null,
    attributes: { filters: [] },
  },
  {
    id: uuid(12),
    slug: 'phones-tablets',
    parent_id: uuid(1),
    name: 'Phones & Tablets',
    sort: 1,
    nav_rank: null,
    nav_label: null,
    hero_key: null,
    attributes: { filters: [] },
  },
  {
    id: uuid(99),
    slug: 'orphan',
    parent_id: uuid(98),
    name: 'Orphan',
    sort: 1,
    nav_rank: null,
    nav_label: null,
    hero_key: null,
    attributes: { filters: [] },
  },
];

describe('CategoryAttributes', () => {
  it('accepts the documented shape', () => {
    expect(
      CategoryAttributes.parse({
        filters: [{ key: 'storage_gb', label: 'Storage', type: 'enum', options: [64, 128] }],
        free_only: true,
        notice: 'Supplies only.',
      }).filters,
    ).toHaveLength(1);
  });

  it('rejects unknown filter types and keys', () => {
    expect(AttributeFilter.safeParse({ key: 'x', label: 'X', type: 'range' }).success).toBe(false);
    expect(AttributeFilter.safeParse({ key: 'Bad-Key', label: 'X', type: 'text' }).success).toBe(
      false,
    );
    expect(CategoryAttributes.safeParse({ filters: [], extra: 1 }).success).toBe(false);
  });

  it('requires options on enum filters', () => {
    expect(
      AttributeFilter.safeParse({ key: 'x', label: 'X', type: 'enum', options: [] }).success,
    ).toBe(false);
  });
});

describe('buildTaxonomy', () => {
  const taxonomy = buildTaxonomy(rows);

  it('nests subcategories under departments in sort order and drops orphans', () => {
    expect(taxonomy.departments.map((d) => d.slug)).toEqual(['electronics', 'tools']);
    expect(taxonomy.departments[0]?.subcategories.map((s) => s.slug)).toEqual([
      'phones-tablets',
      'gaming',
    ]);
  });

  it('uses nav_label for the bar and splits bar from More', () => {
    const { bar, more } = navDepartments(taxonomy);
    expect(bar.map((d) => d.slug)).toEqual(['electronics']);
    expect(more.map((d) => d.navLabel)).toEqual(['Tools']);
  });

  it('scopes filters by applies_to', () => {
    const electronics = taxonomy.departments[0];
    if (!electronics) throw new Error('missing department');
    expect(filtersFor(electronics).map((f) => f.key)).toEqual(['brand']);
    expect(filtersFor(electronics, 'phones-tablets').map((f) => f.key)).toEqual([
      'brand',
      'storage_gb',
    ]);
  });
});

describe('listingAttributesSchema', () => {
  const schema = listingAttributesSchema([
    { key: 'brand', label: 'Brand', type: 'text' },
    { key: 'storage_gb', label: 'Storage', type: 'enum', options: [64, 128] },
    { key: 'graded', label: 'Graded', type: 'boolean' },
  ]);

  it('accepts valid attributes', () => {
    expect(schema.parse({ brand: 'Apple', storage_gb: 128, graded: true })).toEqual({
      brand: 'Apple',
      storage_gb: 128,
      graded: true,
    });
  });

  it('rejects values outside the enum, wrong types, and unknown keys', () => {
    expect(schema.safeParse({ storage_gb: 100 }).success).toBe(false);
    expect(schema.safeParse({ graded: 'yes' }).success).toBe(false);
    expect(schema.safeParse({ mileage: 10 }).success).toBe(false);
  });
});
