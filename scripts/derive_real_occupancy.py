# Re-emits the derived occupancy as COMPACT array-based SQL (the 210 target days
# are contiguous, so only the occupancy series is needed per hotel).
import csv, datetime, statistics
from collections import defaultdict

TODAY = datetime.date(2026, 7, 16)
HISTORY_DAYS, FORECAST_DAYS = 180, 30
HOTELS = {
    'Resort Hotel': ('0873032d-d25a-42ef-9da5-30a76cce0ac9', 'Valinor'),
    'City Hotel':   ('d37dab85-014a-493e-b3fb-e5450e84dd33', 'Rivendell'),
}
M = {m: i + 1 for i, m in enumerate(
    ['January','February','March','April','May','June','July','August','September','October','November','December'])}

occ = defaultdict(lambda: defaultdict(int))
with open('hotels.csv', newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        if r['is_canceled'] == '1':
            continue
        try:
            d0 = datetime.date(int(r['arrival_date_year']), M[r['arrival_date_month']],
                               int(r['arrival_date_day_of_month']))
        except Exception:
            continue
        nights = int(r['stays_in_weekend_nights'] or 0) + int(r['stays_in_week_nights'] or 0)
        for k in range(max(nights, 1)):
            occ[r['hotel']][d0 + datetime.timedelta(days=k)] += 1

span = HISTORY_DAYS + FORECAST_DAYS
target_end = TODAY + datetime.timedelta(days=FORECAST_DAYS)
shift = round((365 * 9 + 2) / 7) * 7
source_end = target_end - datetime.timedelta(days=shift)
source_start = source_end - datetime.timedelta(days=span - 1)
hist_start = target_end - datetime.timedelta(days=span - 1)
fc_start = TODAY + datetime.timedelta(days=1)

out = ["-- REAL occupancy: Hotel Booking Demand (Antonio/Almeida/Nunes 2019) — 119,390 real bookings,",
       "-- two Portuguese hotels 2015-2017. Resort->Valinor, City->Rivendell. Rebased +470 weeks so",
       "-- weekday alignment (weekend spikes) and season are preserved.",
       "delete from occupancy_logs   where hotel_id in ('%s','%s');" % tuple(h[0] for h in HOTELS.values()),
       "delete from booking_forecasts where hotel_id in ('%s','%s');" % tuple(h[0] for h in HOTELS.values())]

for src, (hid, label) in HOTELS.items():
    s = occ[src]
    vals = sorted(s.values())
    cap = vals[int(len(vals) * 0.99)]
    series = []
    for i in range(span):
        sd = source_start + datetime.timedelta(days=i)
        series.append(min(100.0, round(100.0 * s.get(sd, 0) / cap, 1)))
    hist, fc = series[:HISTORY_DAYS], series[HISTORY_DAYS:]
    a_h = ','.join(str(x) for x in hist)
    a_f = ','.join(str(x) for x in fc)
    out.append(
        f"insert into occupancy_logs(hotel_id,date,occupancy_pct,occupied_rooms,total_rooms,source)\n"
        f"select '{hid}'::uuid, date '{hist_start}' + (i-1)::int, p, round(p*{cap}/100.0)::int, {cap}, 'pms'\n"
        f"from unnest(array[{a_h}]::numeric[]) with ordinality as t(p,i);")
    out.append(
        f"insert into booking_forecasts(hotel_id,date,expected_occupancy_pct,horizon_source)\n"
        f"select '{hid}'::uuid, date '{fc_start}' + (i-1)::int, p, 'pms'\n"
        f"from unnest(array[{a_f}]::numeric[]) with ordinality as t(p,i);")
    print(f'-- {label:9s} cap={cap} hist={len(hist)} fc={len(fc)} '
          f'min={min(hist):.1f} max={max(hist):.1f} mean={statistics.mean(hist):.1f} sd={statistics.pstdev(hist):.1f}')

open('occupancy_compact.sql', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('-- bytes:', len('\n'.join(out)))
