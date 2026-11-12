-- 001_init.sql
-- core tables for expirylens. safe to re-run.

-- every tradable thing we track: indices, stocks, futures, options
create table if not exists instruments (
    instrument_key  text primary key,      -- upstox id, e.g. NSE_INDEX|Nifty 50
    symbol          text not null,
    name            text,
    segment         text not null,         -- NSE_INDEX, NSE_EQ, NSE_FO, BSE_FO ...
    kind            text not null,         -- INDEX, EQ, FUT, CE, PE
    underlying      text,                  -- for derivatives: which index
    strike          numeric(12,2),
    expiry          date,
    lot_size        integer
);

-- one row per instrument per minute
create table if not exists candles_1m (
    instrument_key  text not null references instruments(instrument_key),
    ts              timestamptz not null,
    open            numeric(12,2) not null,
    high            numeric(12,2) not null,
    low             numeric(12,2) not null,
    close           numeric(12,2) not null,
    volume          bigint,
    oi              bigint,                -- open interest, derivatives only
    primary key (instrument_key, ts)
);

-- turn candles into a hypertable, split into weekly chunks
select create_hypertable('candles_1m', by_range('ts', interval '7 days'),
                         if_not_exists => true);

-- which days were expiries, and how they settled
create table if not exists expiry_calendar (
    index_name       text not null,        -- NIFTY, BANKNIFTY, SENSEX
    expiry_date      date not null,
    settlement_rule  text not null,        -- VWAP, CAS, VWAP30
    primary key (index_name, expiry_date)
);

-- index weights as they were on each date (avoids look-ahead bias)
create table if not exists index_weights (
    index_name   text not null,
    symbol       text not null,
    weight_pct   numeric(6,3) not null,
    valid_from   date not null,
    valid_to     date,                     -- null means still current
    primary key (index_name, symbol, valid_from)
);

-- official settlement values published by the exchange
create table if not exists settlements (
    index_name        text not null,
    expiry_date       date not null,
    settlement_value  numeric(12,2) not null,
    source            text,
    primary key (index_name, expiry_date)
);

-- rows that failed data checks land here instead of the main tables
create table if not exists quarantine (
    id           bigserial primary key,
    table_name   text not null,
    payload      jsonb not null,
    reason       text not null,
    caught_at    timestamptz not null default now()
);
