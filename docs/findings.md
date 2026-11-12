# Findings log

Running notes on what the data shows. Newest first.

## 2026-11-12: the index freezes during the closing auction

**What we saw.** On Mon 9 Nov 2026 (a likely Nifty expiry, since Tue 10 Nov
had no trading), Nifty 50 1-minute candles were completely flat
(open = high = low = close) for 14 minutes between 15:15 and 15:29. The only
move was a 41 point jump (about 16 bps) in the 15:28 candle.

**Check.** Same test on 27 to 31 Jul 2026, before the Closing Auction Session
(CAS) started on 3 Aug 2026: zero flat minutes after 15:15 on every day.

**Why.** From 3 Aug 2026, F&O stocks stop continuous trading at 15:15 and go
into a closing auction (order entry closes at a random time between 15:28
and 15:30). With no continuous matching, the displayed index stays put.
NSE pointed this out itself after the first CAS day:
https://www.angelone.in/news/market-updates/nse-reports-strong-participation-on-day-1-of-closing-auction-session-for-f-o-stocks

**What it means for ExpiryLens.**
- In the CAS era, the last 15 minutes of 1-minute index data carry no normal
  price information. Detectors that use "last 30 minutes" must handle this
  window separately, or they will measure frozen data.
- A flat-run check alone would wrongly flag CAS days as bad data. The data
  quality rules need to know which settlement regime a day belongs to.

**Still open.**
- What exactly the 15:28 move is: the random close, an indicative auction
  price, or something else. Sources disagree on what the index shows during
  CAS.
- Confirm 10 Nov 2026 as a market holiday against the official NSE list.

**Data.** Upstox Historical Candle V3, instrument NSE_INDEX|Nifty 50,
1-minute candles. Raw data is not committed.
