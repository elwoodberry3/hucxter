-- Local/QA seed data. Runs on `supabase db reset`.
-- No listings, users, or marketplace activity are ever seeded here (CLAUDE.md: never fabricate activity).

-- =============================================================================
-- Category taxonomy v1 (docs/specs/category-taxonomy.md; D-23 default, D-24: no motor vehicles)
-- =============================================================================

insert into public.categories (slug, name, sort, nav_rank, nav_label, hero_key, attributes) values
  ('electronics', 'Electronics', 1, 1, null, 'electronics', $json${"filters": [
    {"key": "brand", "label": "Brand", "type": "text"},
    {"key": "storage_gb", "label": "Storage", "type": "enum", "unit": "GB", "options": [64, 128, 256, 512, 1024], "applies_to": ["phones-tablets", "computers-laptops"]},
    {"key": "screen_size", "label": "Screen size", "type": "enum", "options": ["Under 15 in", "15–24 in", "25–42 in", "43–55 in", "56–65 in", "Over 65 in"], "applies_to": ["tv-home-theater", "computers-laptops"]},
    {"key": "platform", "label": "Platform", "type": "enum", "options": ["PlayStation", "Xbox", "Nintendo", "PC", "Other"], "applies_to": ["gaming"]}
  ]}$json$),
  ('home', 'Home & Living', 2, 2, null, 'home', $json${"filters": [
    {"key": "material", "label": "Material", "type": "enum", "options": ["Wood", "Metal", "Glass", "Fabric", "Leather", "Plastic", "Stone", "Other"]},
    {"key": "color", "label": "Color", "type": "enum", "options": ["Black", "White", "Gray", "Brown", "Beige", "Blue", "Green", "Red", "Multicolor", "Other"]},
    {"key": "room", "label": "Room", "type": "enum", "options": ["Living room", "Bedroom", "Kitchen", "Dining room", "Bathroom", "Office", "Outdoor", "Other"]},
    {"key": "has_dimensions", "label": "Dimensions listed", "type": "boolean"}
  ]}$json$),
  ('garden-outdoor', 'Garden & Outdoor', 3, null, null, 'garden-outdoor', $json${"filters": [
    {"key": "power_source", "label": "Power source", "type": "enum", "options": ["Gas", "Electric", "Battery", "Manual"]}
  ]}$json$),
  ('fashion', 'Fashion', 4, 3, null, 'fashion', $json${"filters": [
    {"key": "size", "label": "Size", "type": "text"},
    {"key": "brand", "label": "Brand", "type": "text"},
    {"key": "fit", "label": "Gender / fit", "type": "enum", "options": ["Women's", "Men's", "Unisex", "Kids'"]},
    {"key": "color", "label": "Color", "type": "enum", "options": ["Black", "White", "Gray", "Brown", "Beige", "Blue", "Green", "Red", "Multicolor", "Other"]}
  ]}$json$),
  ('baby-kids', 'Baby & Kids', 5, 6, null, 'baby-kids', $json${"filters": [
    {"key": "age_range", "label": "Age range", "type": "enum", "options": ["0–6 months", "6–12 months", "1–2 years", "3–5 years", "6–8 years", "9–12 years"]}
  ]}$json$),
  ('sports-outdoors', 'Sports & Outdoors', 6, 4, null, 'sports-outdoors', $json${"filters": [
    {"key": "bike_type", "label": "Bike type", "type": "enum", "options": ["Road", "Mountain", "Hybrid", "BMX", "Electric", "Cruiser", "Kids"], "applies_to": ["bikes"]},
    {"key": "bike_size", "label": "Bike size", "type": "enum", "options": ["XS", "S", "M", "L", "XL"], "applies_to": ["bikes"]},
    {"key": "brand", "label": "Brand", "type": "text"}
  ], "notice": "No firearms or ammunition."}$json$),
  ('tools', 'Tools & Home Improvement', 7, 5, 'Tools', 'tools', $json${"filters": [
    {"key": "power_source", "label": "Power source", "type": "enum", "options": ["Gas", "Corded electric", "Battery", "Manual"]},
    {"key": "brand", "label": "Brand", "type": "text"}
  ]}$json$),
  ('hobbies', 'Hobbies & Collectibles', 8, null, null, 'hobbies', $json${"filters": [
    {"key": "graded", "label": "Graded", "type": "boolean", "applies_to": ["trading-cards"]},
    {"key": "format", "label": "Format", "type": "enum", "options": ["Book", "Vinyl", "CD", "DVD", "Blu-ray", "Video game", "Other"], "applies_to": ["books-movies-music"]}
  ]}$json$),
  ('music', 'Musical Instruments', 9, null, null, 'music', $json${"filters": [
    {"key": "brand", "label": "Brand", "type": "text"},
    {"key": "instrument_type", "label": "Instrument type", "type": "enum", "options": ["Acoustic", "Electric", "Digital", "Other"]}
  ]}$json$),
  ('auto-parts', 'Auto Parts & Accessories', 10, null, null, 'auto-parts', $json${"filters": [
    {"key": "fits_make_model", "label": "Fits make/model", "type": "text"}
  ], "notice": "Parts and accessories only. No cars, trucks, motorcycles, or boats."}$json$),
  ('pet-supplies', 'Pet Supplies', 11, null, null, 'pet-supplies', $json${"filters": [
    {"key": "pet_type", "label": "Pet type", "type": "enum", "options": ["Dog", "Cat", "Fish", "Small animal", "Bird"]}
  ], "notice": "Supplies only. No live animals."}$json$),
  ('office', 'Office & Business', 12, null, null, 'office', '{"filters": []}'),
  ('free', 'Free Stuff', 13, 7, null, 'free', '{"filters": [], "free_only": true}'),
  ('misc', 'Garage Sale & Misc', 14, null, null, 'misc', '{"filters": []}');

insert into public.categories (parent_id, slug, name, sort)
select p.id, s.slug, s.name, s.sort
from (values
  ('electronics', 'computers-laptops', 'Computers & Laptops', 1),
  ('electronics', 'phones-tablets', 'Phones & Tablets', 2),
  ('electronics', 'gaming', 'Gaming', 3),
  ('electronics', 'tv-home-theater', 'TV & Home Theater', 4),
  ('electronics', 'audio-headphones', 'Audio & Headphones', 5),
  ('electronics', 'cameras-drones', 'Cameras & Drones', 6),
  ('electronics', 'smart-home-wearables', 'Smart Home & Wearables', 7),
  ('electronics', 'electronics-accessories', 'Accessories', 8),
  ('home', 'furniture', 'Furniture', 1),
  ('home', 'home-decor', 'Home Decor', 2),
  ('home', 'kitchen-dining', 'Kitchen & Dining', 3),
  ('home', 'appliances', 'Appliances', 4),
  ('home', 'bedding-bath', 'Bedding & Bath', 5),
  ('home', 'lighting', 'Lighting', 6),
  ('home', 'storage-organization', 'Storage & Organization', 7),
  ('garden-outdoor', 'patio-furniture', 'Patio Furniture', 1),
  ('garden-outdoor', 'grills-outdoor-cooking', 'Grills & Outdoor Cooking', 2),
  ('garden-outdoor', 'plants-planters', 'Plants & Planters', 3),
  ('garden-outdoor', 'lawn-garden-tools', 'Lawn & Garden Tools', 4),
  ('garden-outdoor', 'outdoor-decor', 'Outdoor Decor', 5),
  ('fashion', 'womens-clothing', 'Women''s Clothing', 1),
  ('fashion', 'mens-clothing', 'Men''s Clothing', 2),
  ('fashion', 'kids-clothing', 'Kids'' Clothing', 3),
  ('fashion', 'shoes-sneakers', 'Shoes & Sneakers', 4),
  ('fashion', 'bags-accessories', 'Bags & Accessories', 5),
  ('fashion', 'jewelry-watches', 'Jewelry & Watches', 6),
  ('baby-kids', 'baby-gear', 'Baby Gear', 1),
  ('baby-kids', 'strollers-car-seats', 'Strollers & Car Seats', 2),
  ('baby-kids', 'nursery-furniture', 'Nursery Furniture', 3),
  ('baby-kids', 'toys', 'Toys', 4),
  ('baby-kids', 'kids-books', 'Kids'' Books', 5),
  ('sports-outdoors', 'bikes', 'Bikes', 1),
  ('sports-outdoors', 'fitness-equipment', 'Fitness Equipment', 2),
  ('sports-outdoors', 'camping-hiking', 'Camping & Hiking', 3),
  ('sports-outdoors', 'team-sports', 'Team Sports', 4),
  ('sports-outdoors', 'water-sports', 'Water Sports', 5),
  ('sports-outdoors', 'golf', 'Golf', 6),
  ('sports-outdoors', 'hunting-fishing-gear', 'Hunting & Fishing Gear', 7),
  ('tools', 'power-tools', 'Power Tools', 1),
  ('tools', 'hand-tools', 'Hand Tools', 2),
  ('tools', 'building-materials', 'Building Materials', 3),
  ('tools', 'outdoor-power-equipment', 'Outdoor Power Equipment', 4),
  ('tools', 'plumbing-electrical', 'Plumbing & Electrical', 5),
  ('hobbies', 'collectibles', 'Collectibles', 1),
  ('hobbies', 'trading-cards', 'Trading Cards', 2),
  ('hobbies', 'art', 'Art', 3),
  ('hobbies', 'crafts-sewing', 'Crafts & Sewing', 4),
  ('hobbies', 'models-rc', 'Models & RC', 5),
  ('hobbies', 'books-movies-music', 'Books, Movies & Music', 6),
  ('music', 'guitars-basses', 'Guitars & Basses', 1),
  ('music', 'keyboards-pianos', 'Keyboards & Pianos', 2),
  ('music', 'drums-percussion', 'Drums & Percussion', 3),
  ('music', 'dj-pro-audio', 'DJ & Pro Audio', 4),
  ('music', 'band-orchestra', 'Band & Orchestra', 5),
  ('auto-parts', 'wheels-tires', 'Wheels & Tires', 1),
  ('auto-parts', 'vehicle-parts', 'Parts', 2),
  ('auto-parts', 'car-electronics-audio', 'Electronics & Audio', 3),
  ('auto-parts', 'garage-tools', 'Tools & Garage', 4),
  ('auto-parts', 'motorcycle-gear', 'Motorcycle Gear', 5),
  ('pet-supplies', 'dog-supplies', 'Dogs', 1),
  ('pet-supplies', 'cat-supplies', 'Cats', 2),
  ('pet-supplies', 'fish-aquariums', 'Fish & Aquariums', 3),
  ('pet-supplies', 'small-animal-supplies', 'Small Animals', 4),
  ('pet-supplies', 'bird-supplies', 'Birds', 5),
  ('office', 'office-furniture', 'Office Furniture', 1),
  ('office', 'office-electronics', 'Office Electronics', 2),
  ('office', 'office-supplies', 'Supplies', 3),
  ('office', 'restaurant-retail-equipment', 'Restaurant & Retail Equipment', 4),
  ('free', 'free-furniture', 'Furniture', 1),
  ('free', 'free-household', 'Household', 2),
  ('free', 'free-kids', 'Kids', 3),
  ('free', 'free-other', 'Other', 4),
  ('misc', 'bundles-lots', 'Bundles & Lots', 1),
  ('misc', 'everything-else', 'Everything Else', 2)
) as s (parent_slug, slug, name, sort)
join public.categories p on p.slug = s.parent_slug and p.parent_id is null;
