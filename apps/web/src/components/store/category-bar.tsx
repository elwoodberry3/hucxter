import type { Taxonomy } from '@hucxter/contracts';
import { navDepartments } from '@hucxter/contracts';
import { CategoryBarLinks } from './category-bar-links';
import { MegaMenu } from './mega-menu';
import { MoreMenu } from './more-menu';
import styles from './category-bar.module.css';

export interface NavDepartment {
  slug: string;
  name: string;
  navLabel: string;
  subcategories: { slug: string; name: string }[];
}

function toNav(taxonomy: Taxonomy['departments']): NavDepartment[] {
  return taxonomy.map(({ slug, name, navLabel, subcategories }) => ({
    slug,
    name,
    navLabel,
    subcategories: subcategories.map(({ slug: s, name: n }) => ({ slug: s, name: n })),
  }));
}

/** Category bar (storefront-ia §1–2): All Categories mega menu, top departments, More. From data. */
export function CategoryBar({ taxonomy }: { taxonomy: Taxonomy }) {
  const { bar, more } = navDepartments(taxonomy);
  return (
    <nav aria-label="Categories" className={styles.bar}>
      <div className={styles.inner}>
        <MegaMenu departments={toNav(taxonomy.departments)} />
        <CategoryBarLinks departments={toNav(bar)} />
        {more.length > 0 ? <MoreMenu departments={toNav(more)} /> : null}
      </div>
    </nav>
  );
}
