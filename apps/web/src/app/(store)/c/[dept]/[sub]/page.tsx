import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryIndex } from '@/components/results/category-index';
import { findDepartment, findSubcategory, getTaxonomy } from '@/lib/taxonomy';

export async function generateMetadata({
  params,
}: PageProps<'/c/[dept]/[sub]'>): Promise<Metadata> {
  const { dept, sub } = await params;
  const department = findDepartment(await getTaxonomy(), dept);
  const subcategory = department === undefined ? undefined : findSubcategory(department, sub);
  return {
    title:
      department === undefined || subcategory === undefined
        ? 'Not found'
        : `${subcategory.name} · ${department.name}`,
  };
}

export default async function SubcategoryPage({
  params,
  searchParams,
}: PageProps<'/c/[dept]/[sub]'>) {
  const [{ dept, sub }, raw, taxonomy] = await Promise.all([params, searchParams, getTaxonomy()]);
  const department = findDepartment(taxonomy, dept);
  const subcategory = department === undefined ? undefined : findSubcategory(department, sub);
  if (department === undefined || subcategory === undefined) notFound();
  return <CategoryIndex department={department} subcategory={subcategory} searchParams={raw} />;
}
