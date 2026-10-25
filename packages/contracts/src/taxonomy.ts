import { z } from 'zod';

/** Category slugs: lowercase words joined by single hyphens. Stable once released. */
export const CategorySlug = z
  .string()
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const FilterKey = z
  .string()
  .max(40)
  .regex(/^[a-z][a-z0-9_]*$/);

const filterBase = {
  key: FilterKey,
  label: z.string().min(1).max(40),
  /** Subcategory slugs this filter applies to; omitted means the whole department. */
  applies_to: z.array(CategorySlug).min(1).optional(),
};

/** One category-specific filter from a department's `attributes.filters`. */
export const AttributeFilter = z.discriminatedUnion('type', [
  z.object({ ...filterBase, type: z.literal('text') }).strict(),
  z
    .object({
      ...filterBase,
      type: z.literal('enum'),
      options: z.array(z.union([z.string().min(1).max(40), z.number()])).min(1),
      unit: z.string().max(10).optional(),
    })
    .strict(),
  z.object({ ...filterBase, type: z.literal('boolean') }).strict(),
]);
export type AttributeFilter = z.infer<typeof AttributeFilter>;

/** The `categories.attributes` JSON column. */
export const CategoryAttributes = z
  .object({
    filters: z.array(AttributeFilter),
    /** Items in this department are always free (price fixed at $0). */
    free_only: z.boolean().optional(),
    /** Short policy note shown on the category page ("Supplies only. No live animals."). */
    notice: z.string().max(140).optional(),
  })
  .strict();
export type CategoryAttributes = z.infer<typeof CategoryAttributes>;

/** A row of `public.categories` as read by the app (active rows only, via RLS). */
export const CategoryRow = z.object({
  id: z.uuid(),
  slug: CategorySlug,
  parent_id: z.uuid().nullable(),
  name: z.string().min(1).max(60),
  sort: z.number().int(),
  nav_rank: z.number().int().positive().nullable(),
  nav_label: z.string().nullable(),
  hero_key: CategorySlug.nullable(),
  attributes: CategoryAttributes,
});
export type CategoryRow = z.infer<typeof CategoryRow>;

export interface Subcategory {
  id: string;
  slug: string;
  name: string;
}

export interface Department {
  id: string;
  slug: string;
  name: string;
  /** Label for the header category bar. */
  navLabel: string;
  navRank: number | null;
  heroKey: string;
  attributes: CategoryAttributes;
  subcategories: Subcategory[];
}

export interface Taxonomy {
  departments: Department[];
}

/** Builds the department -> subcategory tree. Orphaned subcategories are dropped. */
export function buildTaxonomy(rows: readonly CategoryRow[]): Taxonomy {
  const bySort = (a: CategoryRow, b: CategoryRow) =>
    a.sort - b.sort || a.name.localeCompare(b.name);
  const children = new Map<string, CategoryRow[]>();
  for (const row of rows) {
    if (row.parent_id === null) continue;
    const list = children.get(row.parent_id) ?? [];
    list.push(row);
    children.set(row.parent_id, list);
  }
  const departments = rows
    .filter((row) => row.parent_id === null)
    .sort(bySort)
    .map((row): Department => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      navLabel: row.nav_label ?? row.name,
      navRank: row.nav_rank,
      heroKey: row.hero_key ?? row.slug,
      attributes: row.attributes,
      subcategories: (children.get(row.id) ?? [])
        .sort(bySort)
        .map(({ id, slug, name }) => ({ id, slug, name })),
    }));
  return { departments };
}

/** Departments shown in the header category bar, in bar order. The rest go under "More". */
export function navDepartments(taxonomy: Taxonomy): { bar: Department[]; more: Department[] } {
  const bar = taxonomy.departments
    .filter((d) => d.navRank !== null)
    .sort((a, b) => (a.navRank ?? 0) - (b.navRank ?? 0));
  const more = taxonomy.departments.filter((d) => d.navRank === null);
  return { bar, more };
}

/** Filters that apply to a department, or to one of its subcategories. */
export function filtersFor(department: Department, subcategorySlug?: string): AttributeFilter[] {
  return department.attributes.filters.filter(
    (filter) =>
      filter.applies_to === undefined ||
      (subcategorySlug !== undefined && filter.applies_to.includes(subcategorySlug)),
  );
}

/** zod schema validating a listing's `attributes` against its category's filter definitions. */
export function listingAttributesSchema(filters: readonly AttributeFilter[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const filter of filters) {
    switch (filter.type) {
      case 'text':
        shape[filter.key] = z.string().trim().min(1).max(80).optional();
        break;
      case 'boolean':
        shape[filter.key] = z.boolean().optional();
        break;
      case 'enum': {
        const allowed = new Set<string | number>(filter.options);
        shape[filter.key] = z
          .union([z.string(), z.number()])
          .refine((value) => allowed.has(value), { message: `Not a valid ${filter.label}` })
          .optional();
        break;
      }
    }
  }
  return z.object(shape).strict();
}
