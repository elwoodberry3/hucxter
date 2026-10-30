import 'server-only';
import { CategoryRow, buildTaxonomy } from '@hucxter/contracts';
import type { Department, Subcategory, Taxonomy } from '@hucxter/contracts';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { publicDb } from './supabase';

const CATEGORY_COLUMNS =
  'id, slug, parent_id, name, sort, nav_rank, nav_label, hero_key, attributes';

async function loadTaxonomy(): Promise<Taxonomy> {
  const { data, error } = await publicDb()
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .order('sort')
    .limit(500);
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return buildTaxonomy(z.array(CategoryRow).parse(data));
}

/** The active category tree, cached for 5 minutes (categories change rarely). */
export const getTaxonomy = unstable_cache(loadTaxonomy, ['taxonomy-v1'], {
  revalidate: 300,
  tags: ['taxonomy'],
});

export function findDepartment(taxonomy: Taxonomy, slug: string): Department | undefined {
  return taxonomy.departments.find((department) => department.slug === slug);
}

export function findSubcategory(department: Department, slug: string): Subcategory | undefined {
  return department.subcategories.find((subcategory) => subcategory.slug === slug);
}
