import { navDepartments, parseFeedItems } from '@hucxter/contracts';
import { CategoryGrid } from '@/components/home/category-grid';
import { FeedItemView } from '@/components/home/feed-item';
import { HeroCarousel } from '@/components/home/hero-carousel';
import { PromoStrip } from '@/components/home/promo-strip';
import { Rail } from '@/components/home/rail';
import styles from '@/components/home/home.module.css';
import { PROMO_STRIP, activeSlides, homeFeed } from '@/lib/house-content';
import { getTaxonomy } from '@/lib/taxonomy';
import { getViewerLocation } from '@/lib/viewer-location';

const FEATURED_RAILS = 3;

/** Home = Feed = All (ADR-0009). Looks full with zero listings, and never shows fake ones. */
export default async function HomePage() {
  const [taxonomy, location] = await Promise.all([getTaxonomy(), getViewerLocation()]);
  const near = location === null ? 'near you' : `near ${location.areaLabel}`;
  const feed = parseFeedItems(homeFeed());
  const { bar } = navDepartments(taxonomy);
  const featured = bar
    .filter((department) => !department.attributes.free_only)
    .slice(0, FEATURED_RAILS);
  const free = taxonomy.departments.find((department) => department.attributes.free_only === true);

  // Listings arrive with Brief 04; until then every rail shows its invitation card.
  const listingItems = feed.filter((item) => item.type === 'listing');
  const promoItems = feed.filter((item) => item.type !== 'listing');

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">Hucxter: buy and sell locally</h1>
      <HeroCarousel slides={activeSlides()} />
      <CategoryGrid departments={taxonomy.departments} />

      <Rail
        id="new"
        title={`New ${near}`}
        seeAll={{ label: 'Browse all', href: '/search' }}
        listings={listingItems.map((item) => item.listing)}
        invitation={{
          title: `Be the first to list something ${near}`,
          body: 'New listings from people in your area will show up here. Post a short video of something you’re not using.',
          sellLabel: 'Sell an item',
          browse: { label: 'How selling works', href: '/how-selling-works' },
          heroKey: 'misc',
        }}
      />

      {promoItems.map((item) => (
        <FeedItemView key={item.id} item={item} />
      ))}

      {free === undefined ? null : (
        <Rail
          id="free"
          title={`Free stuff ${near}`}
          seeAll={{ label: `See ${free.name}`, href: `/c/${free.slug}` }}
          listings={[]}
          invitation={{
            title: `Giving something away? Be the first ${near}`,
            body: 'Post something you’re giving away and a neighbor can pick it up.',
            sellLabel: 'Give something away',
            browse: { label: `Browse ${free.name}`, href: `/c/${free.slug}` },
            heroKey: free.heroKey,
          }}
        />
      )}

      <div className={styles.railGrid}>
        {featured.map((department) => (
          <Rail
            compact
            key={department.slug}
            id={department.slug}
            title={`${department.name} ${near}`}
            seeAll={{ label: `See ${department.name}`, href: `/c/${department.slug}` }}
            listings={[]}
            invitation={{
              title: `Be the first to list ${department.name.toLowerCase()} ${near}`,
              body: `Nobody nearby has posted in ${department.name} yet. Your listing could be the first one buyers see.`,
              sellLabel: `Sell in ${department.navLabel}`,
              browse: { label: `Browse ${department.name}`, href: `/c/${department.slug}` },
              heroKey: department.heroKey,
            }}
          />
        ))}
      </div>

      <PromoStrip promos={PROMO_STRIP} />
    </div>
  );
}
