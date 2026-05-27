# Backtest Pro Mobile

A React Native mobile app that wraps the Backtest Pro trading backtesting engine with a native UI shell and WebView bridge.

## Architecture

```
┌─────────────────────────────────────────┐
│  React Native UI Shell                  │
│  • Header, Ticker, Toolbar, Controls    │
│  • Stats, Trade Log, Drawer             │
│  • File Picker, Settings                │
└─────────────────┬───────────────────────┘
                  │ postMessage
┌─────────────────▼───────────────────────┐
│  WebView (chart.html)                   │
│  • Lightweight Charts                   │
│  • Drawing Engine (Canvas)              │
│  • Bar Replay Logic                     │
│  • CSV Parser                           │
│  • Trade Engine                         │
└─────────────────────────────────────────┘
```

## Features

- **Bar-by-bar replay** with ◀ ▶ navigation
- **TradingView-style drawing tools**: Trendlines, Horizontal/Vertical lines, Boxes, Fibonacci
- **Trade simulation**: BUY/SELL with lot sizing, real-time P&L tracking
- **CSV data upload** with asset categorization (FOREX, CRYPTO, FUTURES, COMMODITIES)
- **Trade journal** with notes
- **Dark/Light theme** toggle
- **Offline support** via localStorage in WebView

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- For iOS: macOS with Xcode
- For Android: Android Studio with SDK

## Setup

1. **Install dependencies:**
```bash
cd BacktestProMobile
npm install
# or
yarn install
```

2. **For iOS - additional pods:**
```bash
cd ios
pod install
cd ..
```

3. **Copy chart.html to native assets:**

### Android
```bash
mkdir -p android/app/src/main/assets/
cp assets/chart.html android/app/src/main/assets/
```

### iOS
Add `chart.html` to your Xcode project under `Resources` folder, or use:
```bash
# For Expo managed workflow, the file is auto-bundled via assetExts in metro.config.js
```

## Running the App

### Development

```bash
# Start Expo dev server
npx expo start

# Run on Android
npx expo start --android

# Run on iOS
npx expo start --ios

# Run on Web
npx expo start --web
```

### Building for Production

```bash
# Build Android APK/AAB
npx expo build:android

# Build iOS IPA
npx expo build:ios

# Or use EAS Build (recommended)
npx eas build --platform android
npx eas build --platform ios
```

## Project Structure

```
BacktestProMobile/
├── App.tsx                    # Entry point with navigation
├── app.json                   # Expo configuration
├── package.json               # Dependencies
├── assets/
│   └── chart.html             # WebView chart engine
├── src/
│   ├── hooks/
│   │   └── useWebViewBridge.ts  # Bridge communication hook
│   └── screens/
│       └── BacktestScreen.tsx   # Main screen with all UI
```

## WebView Bridge Protocol

### React Native → WebView (Commands)

| Action | Payload | Description |
|--------|---------|-------------|
| `LOAD_CSV` | `{ csvText, filename }` | Load CSV data |
| `SET_TOOL` | `{ tool: 'cursor'\|'trendline'\|... }` | Set drawing tool |
| `SET_THEME` | `{ theme: 'dark'\|'light' }` | Toggle theme |
| `NEXT_BAR` | - | Advance one bar |
| `PREV_BAR` | - | Go back one bar |
| `GOTO_LATEST` | - | Jump to latest bar |
| `OPEN_TRADE` | `{ type: 'BUY'\|'SELL' }` | Open trade |
| `CLOSE_TRADE` | - | Close current trade |
| `SET_PIP_SIZE` | `{ pipSize: number }` | Set pip size |
| `SET_PIP_VALUE` | `{ pipValue: number }` | Set pip value |
| `CLEAR_DRAWINGS` | - | Clear all drawings |
| `CLEAR_TRADES` | - | Clear trade history |
| `LOAD_DATASET` | `{ id, assetName }` | Load saved dataset |
| `DELETE_DATASET` | `{ cat, pair, id }` | Delete dataset |
| `UPDATE_TOOL_SETTINGS` | `{ color, width, style }` | Update tool style |

### WebView → React Native (Events)

| Action | Payload | Description |
|--------|---------|-------------|
| `APP_READY` | - | WebView initialized |
| `STATS_UPDATE` | `{ totalPnl, winRate, tradeCount, openPnlPips, openPnlUsd, barCounter }` | Stats changed |
| `TRADE_OPENED` | `{ type, price, lotSize }` | Trade opened |
| `TRADE_CLOSED` | `{ trade }` | Trade closed |
| `POSITION_CLOSED` | - | Position closed |
| `PRICE_UPDATE` | `{ price, change, changeColor }` | Price changed |
| `ASSET_LOADED` | `{ asset, status, statusColor }` | Asset loaded |
| `BAR_COUNTER` | `{ counter, showGoto }` | Bar position |
| `DRAWING_SELECTED` | `{ color, width, style }` | Drawing selected |
| `DRAWING_DESELECTED` | - | Drawing deselected |
| `TOAST` | `{ message, color }` | Show toast |
| `ASSET_DB_UPDATE` | `{ assetDB }` | Asset DB updated |
| `TRADES_CLEARED` | - | Trades cleared |

## Known Limitations

1. **WebView file access on iOS**: May need to use `require('./assets/chart.html')` instead of `file://` URI
2. **CSV upload**: Uses `react-native-document-picker` which requires proper permissions
3. **Chart height**: WebView chart fills available space - may need adjustment for different screen sizes
4. **Touch gestures**: Chart pan/zoom works via Lightweight Charts native touch handling

## Troubleshooting

### WebView shows blank screen
- Check that `chart.html` is properly bundled in native assets
- Enable WebView debugging: `javaScriptEnabled={true}` and check console logs

### CSV upload not working
- Check file permissions on Android (`READ_EXTERNAL_STORAGE`)
- On iOS, ensure `NSDocumentsFolderUsageDescription` is set in Info.plist

### Chart not responding to tools
- Make sure `activeTool` state is properly synced between RN and WebView
- Check bridge message format matches expected protocol

## License

Same as original Backtest Pro project.
