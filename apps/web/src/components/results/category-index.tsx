import type { Department, RawSearchParams, Subcategory } from '@hucxter/contracts';
import { DEFAULT_RADIUS_MI, filtersFor, parseListingQuery } from '@hucxter/contracts';
import { track } from '@/lib/analytics';
import { searchListings } from '@/lib/listings';
import { getViewerLocation } from '@/lib/viewer-location';
import { Breadcrumb, CategoryHero, ResultsLayout, SubcategoryRow } from './results-layout';

/** Category index for a department or one of its subcategories (storefront-ia §4). */
export async function CategoryIndex({
  department,
  subcategory,
  searchParams,
}: {
  department: Department;
  subcategory: Subcategory | undefined;
  searchParams: RawSearchParams;
}) {
  const filters = filtersFor(department, subcategory?.slug);
  const query = parseListingQuery(searchParams, filters);
  const location = await getViewerLocation();
  const page = await searchListings({
    query,
    departmentSlug: department.slug,
    ...(subcategory === undefined ? {} : { subcategorySlug: subcategory.slug }),
    zip: location?.zip ?? null,
    limit: 24,
  });
  track({
    name: 'category_viewed',
    department: department.slug,
    ...(subcategory === undefined ? {} : { subcategory: subcategory.slug }),
  });

  const name = subcategory?.name ?? department.name;
  const near = location === null ? 'near you' : `near ${location.areaLabel}`;
  const action =
    subcategory === undefined
      ? `/c/${department.slug}`
      : `/c/${department.slug}/${subcategory.slug}`;

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Feed', href: '/' },
          { label: department.name, href: `/c/${department.slug}` },
          ...(subcategory === undefined ? [] : [{ label: subcategory.name }]),
        ]}
      />
      <SubcategoryRow department={department} activeSlug={subcategory?.slug} />
      <CategoryHero
        title={name}
        eyebrow={subcategory === undefined ? null : department.name}
        heroKey={department.heroKey}
        notice={subcategory === undefined ? department.attributes.notice : undefined}
      />
      <ResultsLayout
        action={action}
        query={query}
        filters={filters}
        freeOnly={department.attributes.free_only === true}
        viewerRadiusMi={location?.radiusMi ?? DEFAULT_RADIUS_MI}
        surface="category"
        listings={page.items}
        areaLabel={location?.areaLabel ?? null}
        empty={{
          title: `Nothing in ${name} ${near} yet`,
          sellLabel:
            department.attributes.free_only === true ? 'Give something away' : `Sell in ${name}`,
          heroKey: department.heroKey,
        }}
      />
    </>
  );
}
