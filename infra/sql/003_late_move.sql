-- 003_late_move.sql
-- how far each index moves from the 15:14 candle to the day's final close.
-- 15:14 is the last minute before the closing auction freezes the index
-- (from aug 2026), so the same metric works across all settlement regimes.

drop view if exists daily_late_move;

create view daily_late_move as
with indices (index_name, instrument_key) as (
    values
        ('NIFTY',  'NSE_INDEX|Nifty 50'),
        ('SENSEX', 'BSE_INDEX|SENSEX')
),
bars as (
    select i.index_name,
           c.ts at time zone 'Asia/Kolkata' as t,
           c.close
    from candles_1m c
    join indices i on i.instrument_key = c.instrument_key
),
per_day as (
    select
        index_name,
        t::date as day,
        max(close) filter (where t::time = '15:14') as px_1514,
        (array_agg(close order by t desc))[1] as px_last,
        count(*) as n
    from bars
    group by 1, 2
)
select
    p.index_name,
    p.day,
    p.px_1514,
    p.px_last,
    round((p.px_last - p.px_1514) / p.px_1514 * 10000, 2) as late_move_bps,
    e.expiry_date is not null as is_expiry,
    case
        when p.day < date '2026-08-03' then 'VWAP_PRE'
        when p.day < date '2026-12-07' then 'CAS'
        else 'VWAP_POST'
    end as regime
from per_day p
left join expiry_calendar e
    on e.index_name = p.index_name and e.expiry_date = p.day
where p.n >= 300 and p.px_1514 is not null;