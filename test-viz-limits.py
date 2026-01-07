#!/usr/bin/env python3
import requests
import json

# Get a signal
response = requests.get('http://localhost:3000/api/scanner/all-signals?limit=1')
data = response.json()

if data['signals']:
    signal = data['signals'][0]
    print('=' * 60)
    print('SIGNAL DETAILS FOR VISUALIZATION TEST')
    print('=' * 60)
    print(f"\nSymbol: {signal['symbol']}")
    print(f"Timeframe: {signal['timeframe']}")
    print(f"Direction: {signal['signal']['direction']}")
    print(f"Entry State: {signal['signal']['entryState']}")

    print(f"\nPatterns Detected:")
    for pattern, value in signal['signal']['patterns'].items():
        if value and pattern.startswith('has'):
            print(f"  ✓ {pattern[3:]}")

    # Check HTF data
    if 'htfData' in signal['signal']:
        print(f"\n📊 HTF Data Available (WILL BE FILTERED):")
        htf = signal['signal']['htfData']

        if htf and 'fvgs' in htf:
            if 'bullish' in htf['fvgs']:
                print(f"  - Bullish FVGs: {len(htf['fvgs']['bullish'])} total")
            if 'bearish' in htf['fvgs']:
                print(f"  - Bearish FVGs: {len(htf['fvgs']['bearish'])} total")

        if htf and 'orderBlocks' in htf:
            if 'bullish' in htf['orderBlocks']:
                print(f"  - Bullish OBs: {len(htf['orderBlocks']['bullish'])} total")
            if 'bearish' in htf['orderBlocks']:
                print(f"  - Bearish OBs: {len(htf['orderBlocks']['bearish'])} total")

    if 'structureAnalysis' in signal['signal']:
        struct = signal['signal']['structureAnalysis']
        if struct:
            if 'chochEvents' in struct and struct['chochEvents']:
                print(f"  - CHoCH Events: {len(struct['chochEvents'])} total")
            if 'bosEvents' in struct and struct['bosEvents']:
                print(f"  - BOS Events: {len(struct['bosEvents'])} total")

    print("\n" + "=" * 60)
    print("CURRENT VISUALIZATION LIMITS:")
    print("=" * 60)

    # Get settings
    settings_response = requests.get('http://localhost:3000/api/settings')
    settings = settings_response.json()

    if 'visualizationLimits' in settings:
        limits = settings['visualizationLimits']
        print(f"  Max FVGs to show: {limits['maxFVGs']}")
        print(f"  Max Order Blocks to show: {limits['maxOrderBlocks']}")
        print(f"  Max CHoCH lines to show: {limits['maxCHOCH']}")
        print(f"  Max BOS lines to show: {limits['maxBOS']}")
        print(f"  Max Candles Back: {limits['maxCandlesBack']}")
        print(f"  Max Distance from Price: {limits['maxDistancePercent']}%")
    else:
        print("  ⚠️ No visualization limits configured (will use defaults)")

    print("\n" + "=" * 60)
    print("EXPECTED BEHAVIOR ON CHART:")
    print("=" * 60)
    print("✓ Chart will filter patterns using the limits above")
    print("✓ Only recent patterns (within maxCandlesBack) will show")
    print("✓ Only nearby patterns (within maxDistancePercent) will show")
    print("✓ Only maxFVGs/maxOrderBlocks/maxCHOCH/maxBOS will display")
    print("\nTo test:")
    print(f"1. Open: http://localhost:3000")
    print(f"2. Go to Signal Tracker tab")
    print(f"3. Click '📊 Chart' on signal: {signal['symbol']}")
    print(f"4. Verify filtered patterns match limits above")
    print("=" * 60)
else:
    print("No signals available for testing")
