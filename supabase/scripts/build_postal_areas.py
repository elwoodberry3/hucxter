"""Generate the postal_areas data migration from US Census 2020 ZCTA files.

Usage (run with -I; the data directory holds the three downloaded files, unmodified):
  python3 -I supabase/scripts/build_postal_areas.py <data-dir> <download-date> > supabase/migrations/<ts>_load_postal_areas_2020.sql

Sources (public domain, US Census Bureau). ZCTA definitions are the 2020 ZCTAs (ZCTA5 2020);
the 2023 Gazetteer is the edition that publishes internal points for exactly that set (33,791):
  https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip
  https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
  https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt

Method (same as Brief 02):
  area_label = Census place (city/town/CDP/etc., type suffix removed) with the largest land overlap,
               else the county (or equivalent) with the largest land overlap.
  state      = state of that county (FIPS -> USPS code).
  point      = the ZCTA's internal point from the 2023 Gazetteer, rounded to 3 decimals.
"""
import csv
import hashlib
import re
import sys

STATE_FIPS = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
    '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
    '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
    '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
    '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
    '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
    '54': 'WV', '55': 'WI', '56': 'WY', '72': 'PR',
}
PLACE_SUFFIX = re.compile(
    r' (city and borough|consolidated government \(balance\)|metro government \(balance\)|'
    r'unified government \(balance\)|urban county|municipality|comunidad|zona urbana|'
    r'city|town|village|borough|CDP)$'
)
BATCH = 1000


def wrap(items, width=90):
    lines, line = [], ''
    for item in items:
        candidate = f'{line}, {item}' if line else item
        if len(candidate) > width:
            lines.append(line + ',')
            line = item
        else:
            line = candidate
    lines.append(line)
    return '\n--   '.join(lines)


def rows(path):
    with open(path, encoding='utf-8-sig') as handle:
        yield from csv.DictReader(handle, delimiter='|')


def sha256(path):
    with open(path, 'rb') as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def main(data, downloaded):
    county_file = f'{data}/tab20_zcta520_county20_natl.txt'
    place_file = f'{data}/tab20_zcta520_place20_natl.txt'
    gazetteer = f'{data}/2023_Gaz_zcta_national.txt'

    best_county = {}
    for r in rows(county_file):
        zcta, county = r['GEOID_ZCTA5_20'], r['GEOID_COUNTY_20']
        if not zcta or not county:
            continue
        land = int(r['AREALAND_PART'] or 0)
        if zcta not in best_county or land > best_county[zcta][1]:
            best_county[zcta] = (county, land, r['NAMELSAD_COUNTY_20'])

    best_place = {}
    for r in rows(place_file):
        zcta = r['GEOID_ZCTA5_20']
        if not zcta or not r['GEOID_PLACE_20']:
            continue
        land = int(r['AREALAND_PART'] or 0)
        if land > 0 and (zcta not in best_place or land > best_place[zcta][1]):
            best_place[zcta] = (r['NAMELSAD_PLACE_20'], land)

    values = []
    states = set()
    skipped = []
    with open(gazetteer, encoding='utf-8') as handle:
        reader = csv.reader(handle, delimiter='\t')
        header = [h.strip() for h in next(reader)]
        for raw in reader:
            r = dict(zip(header, (v.strip() for v in raw)))
            zcta = r['GEOID']
            county = best_county.get(zcta)
            state = None if county is None else STATE_FIPS.get(county[0][:2])
            if county is None or state is None:
                # Outside the 50 states, DC and Puerto Rico (USVI, Guam, CNMI, American Samoa).
                skipped.append(zcta)
                continue
            states.add(state)
            if zcta in best_place:
                label = PLACE_SUFFIX.sub('', best_place[zcta][0])
            else:
                label = county[2]
            label = label[:60].replace("'", "''")
            lat = round(float(r['INTPTLAT']), 3)
            lon = round(float(r['INTPTLONG']), 3)
            values.append(f"  ('{zcta}', '{label}', '{state}', {lon}, {lat})")

    out = sys.stdout
    out.write(f"""-- Load the 2020 Census ZCTAs for the 50 states, DC and Puerto Rico into postal_areas (D-36: any
-- valid US ZIP can be set). Data migration, not seed.sql, so cloud databases get it. Idempotent.
--
-- Coverage: {len(values)} of the {len(values) + len(skipped)} 2020 ZCTAs: the 50 states, DC and Puerto Rico ({len(states)} jurisdictions).
-- No other territories: the {len(skipped)} ZCTAs in the US Virgin Islands, Guam, the Northern Mariana
-- Islands and American Samoa are excluded:
--   {wrap(skipped)}
-- PO-box-only and some business ZIPs are not ZCTAs, so they don't resolve.
-- Source (public domain, US Census Bureau), downloaded {downloaded}. ZCTA definitions: 2020
-- ZCTAs (ZCTA5 2020). Points: the 2023 Gazetteer, which publishes that same 2020 ZCTA set.
-- (The 2020 Gazetteer still lists the older ZCTA set, so it isn't used.)
--   https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip
--     sha256 {sha256(f'{data}/2023_Gaz_zcta_national.zip')}
--   https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
--     sha256 {sha256(county_file)}
--   https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt
--     sha256 {sha256(place_file)}
-- Method (same as Brief 02; generator: supabase/scripts/build_postal_areas.py):
--   area_label = Census place with the largest land overlap (type suffix removed), else the
--   county (or equivalent) with the largest land overlap. state = that county's state.
--   point = ZCTA internal point rounded to 3 decimals (an area centroid, never a person).
-- Note: largest-overlap labels can differ from USPS city names (e.g. 76227 is "Aubrey" for USPS
-- but mostly Cross Roads by land area).
-- Recovery: forward-only data. To undo, delete the rows this file added
--   (delete from public.postal_areas where zip not in (<previous set>)); nothing else changes.

""")
    for start in range(0, len(values), BATCH):
        chunk = values[start:start + BATCH]
        out.write('insert into public.postal_areas (zip, area_label, state, point)\n')
        out.write('select v.zip, v.area_label, v.state,\n')
        out.write('  extensions.st_setsrid(extensions.st_makepoint(v.lon, v.lat), 4326)::extensions.geography\n')
        out.write('from (values\n')
        out.write(',\n'.join(chunk))
        out.write('\n) as v (zip, area_label, state, lon, lat)\n')
        out.write('on conflict (zip) do update set\n')
        out.write('  area_label = excluded.area_label, state = excluded.state, point = excluded.point,\n')
        out.write('  is_active = true;\n\n')
    print(f'{len(values)} ZCTAs, states: {len(states)} {sorted(states)}; skipped {skipped}', file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
