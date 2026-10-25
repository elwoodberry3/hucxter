import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CategoryIndex } from '@/components/results/category-index';
import { findDepartment, getTaxonomy } from '@/lib/taxonomy';

export async function generateMetadata({ params }: PageProps<'/c/[dept]'>): Promise<Metadata> {
  const { dept } = await params;
  const department = findDepartment(await getTaxonomy(), dept);
  return { title: department?.name ?? 'Not found' };
}

export default async function DepartmentPage({ params, searchParams }: PageProps<'/c/[dept]'>) {
  const [{ dept }, raw, taxonomy] = await Promise.all([params, searchParams, getTaxonomy()]);
  const department = findDepartment(taxonomy, dept);
  if (department === undefined) notFound();
  return <CategoryIndex department={department} subcategory={undefined} searchParams={raw} />;
}
