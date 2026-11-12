-- 003_late_move.sql
-- how far nifty moves from the 15:14 candle to the day's final close.
-- 15:14 is the last minute before the closing auction freezes the index
-- (from aug 2026), so the same metric works across all settlement regimes.

create or replace view daily_late_move as
with c as (
    select ts at time zone 'Asia/Kolkata' as t, close
    from candles_1m
    where instrument_key = 'NSE_INDEX|Nifty 50'
),
d as (
    select
        t::date as day,
        max(close) filter (where t::time = '15:14') as px_1514,
        (array_agg(close order by t desc))[1] as px_last,
        count(*) as n
    from c
    group by 1
)
select
    d.day,
    d.px_1514,
    d.px_last,
    round((d.px_last - d.px_1514) / d.px_1514 * 10000, 2) as late_move_bps,
    e.expiry_date is not null as is_expiry,
    case
        when d.day < date '2026-08-03' then 'VWAP_PRE'
        when d.day < date '2026-12-07' then 'CAS'
        else 'VWAP_POST'
    end as regime
from d
left join expiry_calendar e
    on e.index_name = 'NIFTY' and e.expiry_date = d.day
where d.n >= 300 and d.px_1514 is not null;