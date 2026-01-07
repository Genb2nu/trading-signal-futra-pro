#!/usr/bin/env python3
import requests
from datetime import datetime, timezone

# Get current UTC time
now = datetime.now(timezone.utc)
current_hour = now.hour

print("=" * 70)
print("TRADING SESSION HIGHLIGHTING - TEST STATUS")
print("=" * 70)
print(f"\nCurrent UTC Time: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}")
print(f"Current UTC Hour: {current_hour:02d}:00")

# Determine which sessions are active
print("\n📊 SESSION STATUS RIGHT NOW:")
print("-" * 70)

sessions_active = []

# Asia Session: 00:00 - 09:00 UTC
if 0 <= current_hour < 9:
    print("🔵 Asia Session: ACTIVE (00:00 - 09:00 UTC)")
    sessions_active.append("Asia")
else:
    print("⚪ Asia Session: Closed")

# London Session: 08:00 - 17:00 UTC
if 8 <= current_hour < 17:
    print("🟢 London Session: ACTIVE (08:00 - 17:00 UTC)")
    sessions_active.append("London")
else:
    print("⚪ London Session: Closed")

# New York Session: 13:00 - 22:00 UTC
if 13 <= current_hour < 22:
    print("🟠 New York Session: ACTIVE (13:00 - 22:00 UTC)")
    sessions_active.append("New York")
else:
    print("⚪ New York Session: Closed")

# Check for overlaps
print("\n🔄 SESSION OVERLAPS:")
print("-" * 70)
if "Asia" in sessions_active and "London" in sessions_active:
    print("✓ Asia-London Overlap: YES (1 hour window)")
elif 8 <= current_hour < 9:
    print("⏰ Asia-London Overlap: Possible (08:00-09:00 UTC)")
else:
    print("✗ Asia-London Overlap: NO")

if "London" in sessions_active and "New York" in sessions_active:
    print("✓ London-NY Overlap: YES ⭐ HIGHEST LIQUIDITY PERIOD!")
elif 13 <= current_hour < 17:
    print("✓ London-NY Overlap: YES ⭐ HIGHEST LIQUIDITY PERIOD!")
else:
    print("✗ London-NY Overlap: NO")

# Test chart availability
print("\n" + "=" * 70)
print("CHART TEST:")
print("=" * 70)

try:
    response = requests.get('http://localhost:3000/api/scanner/all-signals?limit=1')
    data = response.json()

    if data['signals']:
        signal = data['signals'][0]
        print(f"\n✓ Server is running")
        print(f"✓ Signal available for testing: {signal['symbol']}")
        print(f"✓ Timeframe: {signal['timeframe']}")

        print("\n" + "=" * 70)
        print("EXPECTED CHART APPEARANCE:")
        print("=" * 70)
        print("\nWhen you open the chart, you should see:")

        if sessions_active:
            print(f"\n✓ Colored backgrounds for: {', '.join(sessions_active)}")
            for session in sessions_active:
                if session == "Asia":
                    print("  - 🔵 BLUE background for Asia session")
                elif session == "London":
                    print("  - 🟢 GREEN background for London session")
                elif session == "New York":
                    print("  - 🟠 ORANGE background for New York session")
        else:
            print("\n⚠️  All sessions are currently CLOSED")
            print("   Chart will NOT show session highlighting")
            print("   (Sessions only highlight during active hours)")

        print("\n✓ Session labels at center of each period")
        print("✓ Candlesticks and patterns visible on top of sessions")
        print("✓ Legend showing session times (00:00-09:00, 08:00-17:00, 13:00-22:00)")

        print("\n" + "=" * 70)
        print("QUICK TEST STEPS:")
        print("=" * 70)
        print(f"\n1. Open: http://localhost:3000")
        print(f"2. Click: Signal Tracker tab")
        print(f"3. Find signal: {signal['symbol']}")
        print(f"4. Click: 📊 Chart button")
        print(f"5. Observe: Session highlighting (if any active)")
        print(f"6. Scroll down: Check legend for session info")

        if len(sessions_active) >= 2:
            print(f"\n⭐ BONUS: You should see overlapping sessions!")
            print(f"   {' + '.join(sessions_active)} are both visible")

    else:
        print("\n⚠️  No signals available for testing")
        print("   Run a scan first to generate signals")

except Exception as e:
    print(f"\n❌ Error connecting to server: {e}")
    print("   Make sure the server is running on port 3000")

print("\n" + "=" * 70)
print("SESSION HIGHLIGHTING FEATURES:")
print("=" * 70)
print("""
✓ Asia Session (00:00-09:00 UTC):    Light blue background
✓ London Session (08:00-17:00 UTC):  Light green background
✓ New York Session (13:00-22:00 UTC): Light orange background
✓ Session labels visible on chart
✓ Only current day sessions highlighted
✓ Transparent enough to see patterns underneath
✓ Legend documentation at bottom of chart
""")

print("=" * 70)
print("Ready to test in browser! 🌍")
print("=" * 70)
