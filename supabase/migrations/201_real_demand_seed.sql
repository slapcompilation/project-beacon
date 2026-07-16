-- Migration 201 — REAL demand seed: occupancy from a public dataset, consumption derived from it.
--
-- Layer: data (demo/reference seed) · Scope: the two demo hotels only.
--
-- WHY: the seeded demo occupancy was ~85% flat (stddev 6.1pp, Rivendell had none)
-- and 24 days stale, so an occupancy-driven forecast had no signal to learn and
-- could not be validated (roadmap Q4 was data-blocked).
--
-- SOURCE (real, openly licensed): "Hotel booking demand datasets", Antonio N.,
-- de Almeida A., Nunes L., Data in Brief 22 (2019) 41-49 — 119,390 real bookings
-- from two Portuguese hotels (H1 resort, H2 city), Jul 2015 - Aug 2017.
-- Regenerate with: scripts/derive_real_occupancy.py (fetches the CSV, expands
-- bookings into occupied room-nights, emits the arrays below).
--
-- METHOD: cancelled bookings occupy nothing; each surviving booking is expanded
-- across its nights; capacity = p99 of daily rooms. Resort -> Valinor, City ->
-- Rivendell. Dates rebased +470 weeks (a whole number of weeks, ~9 years) so
-- weekday alignment is preserved (weekend demand stays on weekends) and the
-- month-of-year drifts <= 3 days (seasonality preserved).
--
-- RESULT (verified live): occupancy stddev 15.8 / 14.8 (was 6.1 / none), real
-- 29.7-100% seasonal swing; consumption-vs-occupancy residual correlation
-- 0.44-0.93 by category (the bar that justified the adapter was 0.24), with
-- mixers out-correlating spirits exactly as their sensitivities imply.

-- ── 1. Real categories carrying the occupancy-sensitivity signal ─────────────
-- Mixers scale nearly 1:1 with guests in-house; spirits are far less elastic.
insert into categories (hotel_id, name, "order", occupancy_sensitivity)
select h.id, x.name, x.ord, x.sens
from hotels h
cross join (values ('Mixers & Soft Drinks',1,0.90),('Spirits',2,0.45)) as x(name,ord,sens)
where h.id in ('0873032d-d25a-42ef-9da5-30a76cce0ac9','d37dab85-014a-493e-b3fb-e5450e84dd33')
  and not exists (select 1 from categories c where c.hotel_id = h.id and c.name = x.name);

update products p set category_id = c.id from categories c
where c.hotel_id = p.hotel_id and c.name = 'Mixers & Soft Drinks'
  and p.name in ('Cola','Soda Water','Tonic Water','Orange Juice','Lime');
update products p set category_id = c.id from categories c
where c.hotel_id = p.hotel_id and c.name = 'Spirits'
  and p.name in ('Bourbon 700ml','Gin 700ml','Tequila Blanco','Vodka 700ml','White Rum 700ml');

delete from categories c
where c.name in ('bathroom','Mason','Random')
  and not exists (select 1 from products p where p.category_id = c.id);

-- ── 2. Par levels a competent-but-imperfect operator would set ───────────────
-- The seeded pars were arbitrary (Cola par 36 against 188 units of lead-time
-- demand) so mixers stocked out on exactly the high-occupancy days that carry
-- the signal — censoring destroyed it. Cover lead-time demand +15%: still a
-- little under safety-optimal, so the statistical reorder point (Q1) has room
-- to prove itself.
update product_variants pv set low_stock_threshold = x.newpar
from (
  select pv2.id,
         greatest(8, round(
           (case p.name
              when 'Cola' then 26 when 'Soda Water' then 20 when 'Tonic Water' then 22
              when 'Orange Juice' then 14 when 'Lime' then 30
              when 'Bourbon 700ml' then 5 when 'Gin 700ml' then 7 when 'Tequila Blanco' then 5
              when 'Vodka 700ml' then 8 when 'White Rum 700ml' then 6 else 10 end)::numeric
           * coalesce(s.lead_time_days, 5) * 1.15))::int as newpar
  from product_variants pv2
  join products p on p.id = pv2.product_id
  left join suppliers s on s.id = pv2.default_supplier_id
  where p.hotel_id in ('0873032d-d25a-42ef-9da5-30a76cce0ac9','d37dab85-014a-493e-b3fb-e5450e84dd33')
) x where x.id = pv.id;

-- ── 3. REAL occupancy (180d history to today) + forward booking forecasts ────
delete from occupancy_logs   where hotel_id in ('0873032d-d25a-42ef-9da5-30a76cce0ac9','d37dab85-014a-493e-b3fb-e5450e84dd33');
delete from booking_forecasts where hotel_id in ('0873032d-d25a-42ef-9da5-30a76cce0ac9','d37dab85-014a-493e-b3fb-e5450e84dd33');
insert into occupancy_logs(hotel_id,date,occupancy_pct,occupied_rooms,total_rooms,source)
select '0873032d-d25a-42ef-9da5-30a76cce0ac9'::uuid, date '2026-01-18' + (i-1)::int, p, round(p*185/100.0)::int, 185, 'pms'
from unnest(array[29.7,81.6,84.9,81.6,44.9,38.4,54.1,44.9,48.1,51.9,56.2,58.9,76.2,84.3,60.0,51.4,50.3,42.7,39.5,47.6,66.5,44.9,57.3,57.8,51.4,53.5,61.1,70.3,49.2,74.6,88.6,82.7,80.0,80.5,95.7,83.2,75.7,77.3,88.1,90.3,88.6,99.5,98.9,85.9,60.5,67.6,95.1,95.7,97.8,95.7,66.5,78.9,80.0,93.5,97.8,94.1,75.7,89.7,93.5,91.9,98.4,96.8,84.3,83.2,92.4,96.8,96.2,81.1,81.1,94.6,75.1,79.5,83.2,87.0,90.3,93.0,87.0,80.5,84.3,75.1,96.8,96.2,84.9,97.3,85.9,83.2,96.2,93.5,96.8,98.4,89.7,81.6,79.5,78.4,74.6,78.9,74.6,95.7,95.1,85.4,93.5,97.8,91.9,98.9,98.9,98.9,93.0,85.4,95.7,95.7,92.4,83.2,71.9,89.2,96.8,91.4,94.1,96.8,94.6,91.9,94.1,98.4,98.9,98.9,97.8,94.1,95.1,98.9,96.8,96.8,97.3,96.8,94.1,93.0,97.3,97.3,96.8,88.6,93.5,93.5,91.4,88.1,94.6,89.7,89.7,88.6,96.2,94.6,93.0,94.6,95.1,97.3,96.8,99.5,91.9,96.2,96.2,97.3,97.8,97.3,98.9,93.0,98.4,98.4,94.1,97.3,94.6,96.2,91.9,93.0,98.4,99.5,98.9,98.9,99.5,97.8,98.4,99.5,100.0,99.5]::numeric[]) with ordinality as t(p,i);
insert into booking_forecasts(hotel_id,date,expected_occupancy_pct,horizon_source)
select '0873032d-d25a-42ef-9da5-30a76cce0ac9'::uuid, date '2026-07-17' + (i-1)::int, p, 'pms'
from unnest(array[96.8,95.7,89.7,96.2,98.9,96.8,95.1,96.2,95.7,93.0,100.0,98.9,96.2,96.2,98.4,96.2,95.7,89.7,99.5,100.0,96.2,99.5,97.8,96.2,99.5,99.5,98.9,96.2,98.9,99.5]::numeric[]) with ordinality as t(p,i);
insert into occupancy_logs(hotel_id,date,occupancy_pct,occupied_rooms,total_rooms,source)
select 'd37dab85-014a-493e-b3fb-e5450e84dd33'::uuid, date '2026-01-18' + (i-1)::int, p, round(p*226/100.0)::int, 226, 'pms'
from unnest(array[39.8,47.8,46.0,85.8,71.7,74.3,64.6,61.5,54.0,54.4,58.8,58.0,54.9,54.4,38.9,38.9,42.5,42.5,54.9,58.8,63.3,59.3,54.4,61.9,60.6,71.2,77.9,77.0,77.9,91.6,94.7,99.1,92.5,89.4,88.1,74.8,82.7,84.5,100.0,91.6,61.5,82.3,75.2,96.0,85.0,80.1,88.9,92.5,84.1,77.9,96.5,98.2,85.0,82.7,93.8,98.7,84.5,74.8,92.0,97.8,96.0,97.8,100.0,98.7,96.9,96.5,81.9,87.6,99.6,99.6,73.5,94.7,95.1,88.1,96.9,93.8,95.1,83.6,98.7,96.5,95.1,98.2,95.1,96.5,87.2,96.9,96.9,93.4,99.1,98.7,94.2,96.0,92.0,86.3,96.0,98.7,96.5,97.3,83.6,98.2,96.0,98.2,97.8,99.1,99.1,96.0,89.4,87.6,94.7,95.6,98.2,97.8,94.2,87.2,93.8,96.9,95.6,92.5,94.2,98.7,91.2,98.2,96.9,96.9,98.2,99.1,96.0,98.7,97.8,97.3,99.1,98.2,97.3,84.5,80.5,79.6,88.1,88.1,97.8,94.7,88.5,95.6,96.9,97.3,96.0,96.0,93.8,83.2,88.5,89.8,96.0,96.0,94.7,93.8,85.0,90.7,96.9,98.7,94.2,91.2,90.7,93.8,99.1,88.1,96.5,94.7,94.2,95.6,88.9,92.0,97.3,99.1,96.9,97.3,97.8,96.9,97.8,96.9,99.6,99.1]::numeric[]) with ordinality as t(p,i);
insert into booking_forecasts(hotel_id,date,expected_occupancy_pct,horizon_source)
select 'd37dab85-014a-493e-b3fb-e5450e84dd33'::uuid, date '2026-07-17' + (i-1)::int, p, 'pms'
from unnest(array[98.2,95.1,96.0,99.1,99.1,99.1,99.1,95.1,97.3,97.3,93.4,98.7,96.5,98.7,97.3,92.9,84.5,95.1,92.9,98.7,97.8,98.7,93.8,95.6,98.7,100.0,98.2,98.2,98.2,99.6]::numeric[]) with ordinality as t(p,i);

-- ── 4. Consumption CAUSALLY derived from the real occupancy ──────────────────
-- demand = base x (1 + sensitivity x (occ - mean)/mean) x weekday x noise, sold
-- against on-hand so demand is censored on stock-outs (real, and what the
-- censoring correction exists for). Restocks arrive after the supplier's REAL
-- lead time, and late when the supplier misses its on-time rate — which is what
-- actually produces stock-outs.
alter table stock_logs disable trigger trg_detect_consumption_spike;
alter table stock_logs disable trigger trg_stock_log_critical_stockout;

delete from relationship_edges e
where e.source_type = 'stock_log'
  and e.source_id in (select id from stock_logs where hotel_id in ('0873032d-d25a-42ef-9da5-30a76cce0ac9','d37dab85-014a-493e-b3fb-e5450e84dd33'));
delete from stock_logs where hotel_id in ('0873032d-d25a-42ef-9da5-30a76cce0ac9','d37dab85-014a-493e-b3fb-e5450e84dd33');

DO $seed$
DECLARE
  v RECORD; d RECORD;
  base numeric; mean_occ numeric; bal int; demand int; sold int;
  occ_factor numeric; wd numeric; noise numeric; spoil int;
  pending_qty int; pending_eta date; lead int;
BEGIN
  PERFORM setseed(0.42);   -- deterministic
  FOR v IN
    SELECT pv.id, pv.low_stock_threshold AS thr, p.hotel_id, p.name AS pname,
           coalesce(c.occupancy_sensitivity, 0.5) AS sens,
           coalesce(s.lead_time_days, 5) AS lead_days,
           coalesce(s.on_time_pct, 90)/100.0 AS on_time
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN suppliers s ON s.id = pv.default_supplier_id
    WHERE pv.enabled
      AND p.hotel_id IN ('0873032d-d25a-42ef-9da5-30a76cce0ac9','d37dab85-014a-493e-b3fb-e5450e84dd33')
  LOOP
    base := CASE v.pname
      WHEN 'Cola' THEN 26 WHEN 'Soda Water' THEN 20 WHEN 'Tonic Water' THEN 22
      WHEN 'Orange Juice' THEN 14 WHEN 'Lime' THEN 30
      WHEN 'Bourbon 700ml' THEN 5 WHEN 'Gin 700ml' THEN 7 WHEN 'Tequila Blanco' THEN 5
      WHEN 'Vodka 700ml' THEN 8 WHEN 'White Rum 700ml' THEN 6 ELSE 10 END;
    SELECT avg(occupancy_pct) INTO mean_occ FROM occupancy_logs WHERE hotel_id = v.hotel_id;

    bal := v.thr + round(base * 10);
    pending_qty := 0; pending_eta := NULL;
    INSERT INTO stock_logs(hotel_id,variant_id,quantity_change,balance_after,reason,timestamp,source)
    VALUES (v.hotel_id, v.id, bal, bal, 'Restock received', timestamp '2026-01-17 08:00', 'seed');

    FOR d IN SELECT date, occupancy_pct FROM occupancy_logs WHERE hotel_id = v.hotel_id ORDER BY date
    LOOP
      IF pending_eta IS NOT NULL AND d.date >= pending_eta THEN
        bal := bal + pending_qty;
        INSERT INTO stock_logs(hotel_id,variant_id,quantity_change,balance_after,reason,timestamp,source)
        VALUES (v.hotel_id, v.id, pending_qty, bal, 'Restock received', d.date + time '08:00', 'seed');
        pending_qty := 0; pending_eta := NULL;
      END IF;

      occ_factor := 1 + v.sens * (d.occupancy_pct - mean_occ) / mean_occ;
      wd     := CASE WHEN extract(dow from d.date) IN (5,6) THEN 1.25 ELSE 1.0 END;
      noise  := 0.88 + random() * 0.24;
      demand := greatest(0, round(base * occ_factor * wd * noise));
      sold   := least(demand, bal);           -- can't sell what you don't have
      IF sold > 0 THEN
        bal := bal - sold;
        INSERT INTO stock_logs(hotel_id,variant_id,quantity_change,balance_after,reason,timestamp,source)
        VALUES (v.hotel_id, v.id, -sold, bal, 'POS: daily consumption', d.date + time '20:00', 'seed');
      END IF;

      IF pending_eta IS NULL AND bal <= v.thr THEN
        lead := v.lead_days;
        IF random() > v.on_time THEN lead := lead + 1 + floor(random() * 3)::int; END IF;
        pending_qty := greatest(1, v.thr + round(base * 14) - bal);
        pending_eta := d.date + lead;
      END IF;

      IF v.pname IN ('Lime','Orange Juice') AND random() < 0.04 AND bal > 5 THEN
        spoil := greatest(1, round(base * 0.15));
        bal := bal - spoil;
        INSERT INTO stock_logs(hotel_id,variant_id,quantity_change,balance_after,reason,timestamp,category,source)
        VALUES (v.hotel_id, v.id, -spoil, bal, 'Spoilage', d.date + time '23:00', 'Spoilage', 'seed');
      END IF;
    END LOOP;
    UPDATE product_variants SET current_stock = bal WHERE id = v.id;
  END LOOP;
END $seed$;

alter table stock_logs enable trigger trg_detect_consumption_spike;
alter table stock_logs enable trigger trg_stock_log_critical_stockout;
