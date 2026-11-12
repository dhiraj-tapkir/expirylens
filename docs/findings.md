# Findings log

Running notes on what the data shows. Newest first.

## 2026-11-12: Nifty and Sensex react to the auction in opposite ways

Same late-move metric (15:14 candle to final close), now for both indices.
Median absolute late move, bps:

| Index | Regime | Normal | Expiry | Gap | p (10k shuffles) |
|---|---|---|---|---|---|
| Nifty | VWAP_PRE (48 expiries) | 4.3 | 7.7 | +3.3 | 0.0012 |
| Nifty | CAS (15) | 11.8 | 14.3 | +2.5 | 0.27 |
| Sensex | VWAP_PRE (48) | 5.1 | 6.1 | +0.9 | 0.18 |
| Sensex | CAS (14) | 9.1 | 18.4 | +9.4 | 0.0084 |
| Sensex | CAS without 13 Aug 2026 (13) | | | +8.9 | 0.015 |

**Reading it.**
- Five tests, so the bar is p < 0.01 (Bonferroni). Two pass: Nifty under
  VWAP settlement and Sensex under the closing auction.
- The indices move in opposite directions after the switch: Nifty's expiry
  effect shrinks, Sensex's roughly doubles.
- Leaving out 13 Aug 2026 (the expiry in SEBI's Copthall interim order)
  barely changes the Sensex gap (9.4 to 8.9 bps). One day is not driving it.

**Possible explanations (untested).** Chance with small CAS samples, a real
difference in how easy each exchange's closing auction is to move (e.g.
auction depth), or hedging flows that differ by exchange.

**Not a claim of manipulation.** These are patterns, not evidence of intent.
SEBI's order on 13 Aug 2026 is interim, not final.

**Next.** Measure closing auction volume per exchange, add Bank Nifty, and
rerun once more CAS and post-December expiries are in.
## 2026-11-12: expiry days have bigger late moves (VWAP era, significant)

**Metric.** Late move = Nifty's change from the 15:14 candle to the day's
final close, in bps. 15:14 is the last minute before the closing auction
freezes the index, so the metric works in both regimes.

**Result.** Median absolute late move, expiry vs normal days:

| Regime | Normal | Expiry | Gap | Permutation p (10k shuffles) |
|---|---|---|---|---|
| VWAP_PRE (Sep 2025 to Jul 2026, 48 expiries) | 4.3 bps | 7.7 bps | +3.3 bps | 0.0012 |
| CAS (Aug to Nov 2026, 15 expiries) | 11.8 bps | 14.3 bps | +2.5 bps | 0.27 |

**Reading it.**
- VWAP era: the expiry effect is strong and very unlikely to be chance.
- CAS era: the gap is smaller and not significant, but 15 expiries is a
  small sample. We cannot yet tell whether the auction removed the effect or
  just made it harder to detect.
- Levels are not comparable across regimes. In the CAS era 15 minutes of
  price discovery land in one auction jump, so all late moves look bigger.

**Not a claim of manipulation.** Bigger expiry-day moves also fit innocent
explanations such as option hedging flows. The data shows a pattern, not
intent.

**Side note.** The auction jump landed in the 15:28 candle on 9 Nov and the
15:29 candle on 11 Nov, consistent with the random close between 15:28 and
15:30.

**Next.** Use official settlement values instead of the last candle, add
Sensex as a second index, and revisit the CAS result after more expiries.

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
