#!/usr/bin/env python3
import requests
from datetime import datetime, timezone

# Get current UTC time
now = datetime.now(timezone.utc)
current_hour = now.hour

print("=" * 80)
print("SESSION HIGH/LOW MARKERS - VISUAL TEST GUIDE")
print("=" * 80)
print(f"\nCurrent UTC Time: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}")
print(f"Current Hour: {current_hour:02d}:00")

# Determine which sessions are active
print("\n📊 ACTIVE SESSIONS (with High/Low markers):")
print("-" * 80)

sessions_active = []

# Asia Session: 00:00 - 09:00 UTC
if 0 <= current_hour < 9:
    print("🔵 Asia Session: ACTIVE (00:00 - 09:00 UTC)")
    print("   → Blue dashed lines at Asia High and Asia Low")
    print("   → ▼ Marker showing 'Asia H: XX.XX'")
    print("   → ▲ Marker showing 'Asia L: XX.XX'")
    sessions_active.append("Asia")
elif current_hour >= 9:
    print("🔵 Asia Session: COMPLETED")
    print("   → Blue dashed lines visible (High and Low)")
    print("   → Markers at 09:00 UTC showing exact prices")
else:
    print("⚪ Asia Session: Not started yet")

print()

# London Session: 08:00 - 17:00 UTC
if 8 <= current_hour < 17:
    print("🟢 London Session: ACTIVE (08:00 - 17:00 UTC)")
    print("   → Green dashed lines at London High and London Low")
    print("   → ▼ Marker showing 'London H: XX.XX' at current time")
    print("   → ▲ Marker showing 'London L: XX.XX' at current time")
    sessions_active.append("London")
elif current_hour >= 17:
    print("🟢 London Session: COMPLETED")
    print("   → Green dashed lines visible (High and Low)")
    print("   → Markers at 17:00 UTC showing exact prices")
else:
    print("⚪ London Session: Not started yet")

print()

# New York Session: 13:00 - 22:00 UTC
if 13 <= current_hour < 22:
    print("🟠 New York Session: ACTIVE (13:00 - 22:00 UTC)")
    print("   → Orange dashed lines at NY High and NY Low")
    print("   → ▼ Marker showing 'New York H: XX.XX' at current time")
    print("   → ▲ Marker showing 'New York L: XX.XX' at current time")
    sessions_active.append("New York")
elif current_hour >= 22:
    print("🟠 New York Session: COMPLETED")
    print("   → Orange dashed lines visible (High and Low)")
    print("   → Markers at 22:00 UTC showing exact prices")
else:
    print("⚪ New York Session: Not started yet")

# Count total lines and markers
total_lines = 0
total_markers = 0
for _ in sessions_active:
    total_lines += 2  # High and Low lines
    total_markers += 2  # High and Low markers

if current_hour >= 9:
    total_lines += 2  # Asia completed
    total_markers += 2
if current_hour >= 17:
    total_lines += 2  # London completed
    total_markers += 2
if current_hour >= 22:
    total_lines += 2  # NY completed
    total_markers += 2

print("\n" + "=" * 80)
print("EXPECTED VISUAL ELEMENTS ON CHART:")
print("=" * 80)
print(f"\n📍 Total Dashed Lines: {total_lines} (2 per session: High + Low)")
print(f"📍 Total Markers: {total_markers} (▼ for High, ▲ for Low)")

if len(sessions_active) >= 2:
    print(f"\n⭐ BONUS: Multiple sessions active!")
    print(f"   You'll see high/low lines for: {', '.join(sessions_active)}")
    print(f"   Each with different colors - easy to distinguish!")

# Test chart availability
print("\n" + "=" * 80)
print("QUICK TEST STEPS:")
print("=" * 80)

try:
    response = requests.get('http://localhost:3000/api/scanner/all-signals?limit=1')
    data = response.json()

    if data['signals']:
        signal = data['signals'][0]
        print(f"\n1. Open: http://localhost:3000")
        print(f"2. Click: Signal Tracker tab")
        print(f"3. Find: {signal['symbol']} signal")
        print(f"4. Click: 📊 Chart button")

        print("\n5. VERIFY - Look for these elements:")
        print("   " + "-" * 76)

        if sessions_active or current_hour >= 9:
            print("   ✓ Dashed horizontal lines across the chart")
            print("   ✓ Lines have session colors (blue/green/orange)")
            print("   ✓ Price axis labels (e.g., 'London High', 'NY Low')")
            print("   ✓ Arrow markers (▼ for high, ▲ for low)")
            print("   ✓ Markers show exact prices with session names")
        else:
            print("   ⚠️  No sessions active yet - wait for session to start")

        print("\n6. SCROLL DOWN - Check the legend:")
        print("   " + "-" * 76)
        print("   ✓ Find '🌍 Trading Sessions' section")
        print("   ✓ Read: 'Dashed horizontal lines show session high and low prices'")
        print("   ✓ Read: 'High/Low markers (▼ ▲) display at session end'")
        print("   ✓ See trading tip about support/resistance")

    else:
        print("\n⚠️  No signals available")
        print("   Run a scan first to generate test signals")

except Exception as e:
    print(f"\n❌ Error: {e}")
    print("   Ensure server is running on port 3000")

print("\n" + "=" * 80)
print("WHAT TO LOOK FOR:")
print("=" * 80)

print("""
✓ DASHED LINES:
  - Horizontal lines spanning the chart
  - Different colors per session (blue/green/orange)
  - One at session high, one at session low
  - NOT solid lines (they should be dashed)

✓ PRICE LABELS:
  - On the right price axis
  - Show session name + "High" or "Low"
  - Examples: "London High", "NY Low", "Asia High"

✓ ARROW MARKERS:
  - ▼ Down arrow at session high (above bars)
  - ▲ Up arrow at session low (below bars)
  - Text shows: "Session H: XX.XX" or "Session L: XX.XX"
  - Position: at session end (or current time if ongoing)

✓ ACCURACY:
  - Session high line = highest point of all candles in that session
  - Session low line = lowest point of all candles in that session
  - You can verify by looking at the candles visually
""")

print("=" * 80)
print("VISUAL EXAMPLE:")
print("=" * 80)
print("""
Chart appearance:

Price
13.40 ┤  - - - - - - - - - - - - - - ← London High (green dashed)
      ┤                  ▼ London H: 13.39
      ┤  [======= LONDON SESSION =======]
13.30 ┤      📈  📉     📈  📉
      ┤  📉         📈
13.20 ┤  - - - - - - - - - - - - - - ← London Low (green dashed)
      ┤  ▲ London L: 13.21
      └────────┬──────────────┬─────────
             08:00          17:00

Key:
[===] = Session background
- - - = Dashed lines (high/low)
▼     = High marker with price
▲     = Low marker with price
""")

print("=" * 80)
print("TRADING USE CASES:")
print("=" * 80)
print("""
1. SUPPORT/RESISTANCE:
   - Session highs act as resistance levels
   - Session lows act as support levels
   - Price often bounces at these levels

2. BREAKOUTS:
   - Break above session high = Bullish breakout
   - Break below session low = Bearish breakdown
   - Strong momentum signals

3. RANGE TRADING:
   - Buy near session low
   - Sell near session high
   - Exit if breaks range

4. ENTRY/EXIT PLANNING:
   - Place stops below session lows (for longs)
   - Place stops above session highs (for shorts)
   - Take profit at next session high/low
""")

print("=" * 80)
print("Ready to test! 📍")
print("=" * 80)
print("\nThe session high/low markers are LIVE!")
print("Open the chart to see dashed lines and arrow markers showing key levels!")
print("=" * 80)
