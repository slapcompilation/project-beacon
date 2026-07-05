-- Migration 195: public bucket for the self-hosted MapLibre basemap.
--
-- The portfolio/location map now serves its basemap first-party (so no
-- ad-blocker / Shields / proxy can block it). The PMTiles file + Protomaps
-- glyphs + sprite live here, read directly by maplibre-gl via HTTP range
-- requests. Public because a basemap is public data — maplibre reads it with no
-- auth. The large .pmtiles is uploaded by an owner via the dashboard/CLI, not the
-- app, so no INSERT policy is needed (public read is implicit for public buckets).

insert into storage.buckets (id, name, public, file_size_limit)
values ('basemap', 'basemap', true, 6442450944)  -- 6 GB ceiling (zoom-capped planet)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit;
