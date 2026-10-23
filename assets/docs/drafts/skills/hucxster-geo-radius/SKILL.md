#### Skill 2: Geo-Radius & Spatial Query Engine
`.claude/skills/hucxster-geo-radius/SKILL.md`

```markdown
---
name: hucxster-geo-radius
description: Technical instructions and SQL spatial query standards for HUCXSTER's 100-mile geo-fencing and neighborhood location indexing. Use when writing database migrations, feeds, or location filter APIs.
---

# Geo-Location & Spatial Query Standard

## Hard Boundary Policy
Under no circumstances should items listed outside a 100-mile (160,934 meters) radius from the user's current spatial coordinates be rendered in the main organic discovery feed.

## Database Standards (PostGIS)
- Always index user coordinates and item listing coordinates using PostGIS geography types (`GEOGRAPHY(POINT, 4326)`).
- Create a spatial index:
  ```sql
  CREATE INDEX idx_listings_geo ON listings USING GIST (location);