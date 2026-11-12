-- 002_expiry_calendar.sql
-- nifty weekly expiries, worked out from the days we actually have data for.
--
-- rule: nifty expires on tuesday (since sep 2025). if tuesday is a holiday,
-- the expiry moves back to monday. we pick the latest trading day of each
-- week that falls on or before tuesday.
--
-- known gap: if monday AND tuesday were both holidays the expiry would move
-- to the previous week, and this query would miss it. hasn't happened yet.

with days as (
    select (ts at time zone 'Asia/Kolkata')::date as day
    from candles_1m
    where instrument_key = 'NSE_INDEX|Nifty 50'
    group by 1
    having count(*) >= 300          -- skip short special sessions like muhurat
),
weeks as (
    select date_trunc('week', day)::date as week_start, day
    from days
)
insert into expiry_calendar (index_name, expiry_date, settlement_rule)
select
    'NIFTY',
    max(day),
    case
        when max(day) < date '2026-08-03' then 'VWAP_PRE'
        when max(day) < date '2026-12-07' then 'CAS'
        else 'VWAP_POST'
    end
from weeks
where day <= week_start + 1         -- monday or tuesday of that week
group by week_start
on conflict (index_name, expiry_date)
    do update set settlement_rule = excluded.settlement_rule;