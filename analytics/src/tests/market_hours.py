from datetime import datetime
import pytz

def market_open():
    eastern = pytz.timezone("US/Eastern")
    now = datetime.now(eastern)
    hour_decimal = now.hour + now.minute / 60.0
    # 9:30am → 4:30pm = 9.5 → 16.5
    return (now.weekday() < 5) and (9.5 <= hour_decimal <= 16.5)