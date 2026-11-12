-- 002_expiry_calendar.sql
-- weekly expiries for each index, worked out from the days we actually have
-- data for. the table is fully derived, so we rebuild it from scratch each
-- run (inside one transaction, so readers never see it half-built).
--
-- rule: each index expires on a fixed weekday (since sep 2025, nifty on
-- tuesday and sensex on thursday). if that day is a holiday the expiry moves
-- back to the previous trading day, so we take the latest trading day of
-- each week that falls on or before the scheduled weekday.
--
-- edge case: a week is skipped if our data doesn't yet reach its scheduled
-- expiry day. otherwise the last downloaded day would be mistaken for an
-- expiry.
--
-- known gap: if every day from monday up to the scheduled day was a holiday
-- the expiry would fall in the previous week, and this would miss it.

begin;

delete from expiry_calendar;

with indices (index_name, instrument_key, weekday_offset) as (
    values
        ('NIFTY',  'NSE_INDEX|Nifty 50', 1),   -- monday + 1 = tuesday
        ('SENSEX', 'BSE_INDEX|SENSEX',   3)    -- monday + 3 = thursday
),
days as (
    select i.index_name, i.weekday_offset,
           (c.ts at time zone 'Asia/Kolkata')::date as day
    from candles_1m c
    join indices i on i.instrument_key = c.instrument_key
    group by 1, 2, 3
    having count(*) >= 300          -- skip short special sessions like muhurat
),
data_end as (
    select index_name, max(day) as last_day
    from days
    group by 1
),
weeks as (
    select d.index_name, d.weekday_offset, d.day,
           date_trunc('week', d.day)::date as week_start
    from days d
)
insert into expiry_calendar (index_name, expiry_date, settlement_rule)
select
    w.index_name,
    max(w.day),
    case
        when max(w.day) < date '2026-08-03' then 'VWAP_PRE'
        when max(w.day) < date '2026-12-07' then 'CAS'
        else 'VWAP_POST'
    end
from weeks w
join data_end e on e.index_name = w.index_name
where w.day <= w.week_start + w.weekday_offset
  and w.week_start + w.weekday_offset <= e.last_day
group by w.index_name, w.week_start;

commit;