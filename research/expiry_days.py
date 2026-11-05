# Quick look at upcoming Nifty weekly expiries.
#
# Nifty has expired on Tuesdays since Sept 2025. A market holiday can pull
# an expiry a day earlier; we ignore that for now and fix it properly once
# we load the exchange holiday list.

from datetime import date, timedelta

TUESDAY = 1  # python counts Monday as 0
VWAP_SWITCH = date(2026, 12, 7)  # settlement moves back to 30-min VWAP


def next_tuesdays(start, count):
    days_ahead = (TUESDAY - start.weekday()) % 7
    first = start + timedelta(days=days_ahead)
    return [first + timedelta(weeks=i) for i in range(count)]


today = date.today()
for d in next_tuesdays(today, 8):
    rule = "closing auction price" if d < VWAP_SWITCH else "30-min VWAP"
    print(f"{d:%a %d %b %Y}   settles on {rule}")
