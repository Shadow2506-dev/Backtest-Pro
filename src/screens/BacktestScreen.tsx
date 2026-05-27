import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Animated,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DocumentPicker from 'react-native-document-picker';
import { useWebViewBridge } from '../hooks/useWebViewBridge';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const DRAWER_W = Math.min(360, SCREEN_W * 0.85);

// ════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════
type Trade = {
  id: number;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  entryIndex: number;
  exitIndex: number;
  lotSize: number;
  pips: number;
  usdPnl: number;
  win: boolean;
  asset: string;
  date: string;
  note?: string;
};

type Stats = {
  totalPnl: number;
  winRate: string;
  tradeCount: number;
  openPnlPips: string;
  openPnlUsd: string;
  barCounter: string;
};

type AssetDataset = {
  id: number;
  label: string;
  yearRange: string;
  barCount: number;
};

type AssetDB = Record<string, Record<string, AssetDataset[]>>;

// ════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ════════════════════════════════════════════════════════════
export default function BacktestScreen() {
  const {
    webViewRef,
    sendCSVData,
    setTool,
    setTheme,
    nextBar,
    prevBar,
    gotoLatest,
    openTrade,
    closeTrade,
    setPipSize,
    setPipValue,
    clearDrawings,
    clearTrades,
    loadDataset,
    deleteDataset,
    postMessageToWeb,
  } = useWebViewBridge();

  // ── State ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'journal' | 'assets'>('settings');
  const [currentTool, setCurrentTool] = useState('cursor');
  const [isDark, setIsDark] = useState(true);
  const [lotSize, setLotSize] = useState('0.1');
  const [position, setPosition] = useState<{ type: 'BUY' | 'SELL'; price: number; lot: number } | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalPnl: 0,
    winRate: '—',
    tradeCount: 0,
    openPnlPips: '—',
    openPnlUsd: '—',
    barCounter: '—',
  });
  const [trades, setTrades] = useState<Trade[]>([]);
  const [assetDB, setAssetDB] = useState<AssetDB>({});
  const [currentAsset, setCurrentAsset] = useState('NO ASSET');
  const [currentPrice, setCurrentPrice] = useState('-.-----');
  const [priceChange, setPriceChange] = useState('+0.0%');
  const [priceChangeColor, setPriceChangeColor] = useState('#00e676');
  const [statusText, setStatusText] = useState('LOADING...');
  const [statusColor, setStatusColor] = useState('#4a5568');
  const [showGoto, setShowGoto] = useState(false);
  const [toolSettingsVisible, setToolSettingsVisible] = useState(false);
  const [toolColor, setToolColor] = useState('#00e676');
  const [toolWidth, setToolWidth] = useState('2');
  const [toolStyle, setToolStyle] = useState('solid');
  const [toastMsg, setToastMsg] = useState('');
  const [toastColor, setToastColor] = useState('#00e5ff');
  const [toastVisible, setToastVisible] = useState(false);
  const [pipSize, setPipSizeState] = useState('0.0001');
  const [pipValue, setPipValueState] = useState('10');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [expandedPairs, setExpandedPairs] = useState<Record<string, boolean>>({});
  const [selectedTimeframe, setSelectedTimeframe] = useState(1);

  const drawerAnim = useRef(new Animated.Value(-DRAWER_W)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  // ── Drawer animation ──
  useEffect(() => {
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: drawerOpen ? 0 : -DRAWER_W,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: drawerOpen ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerOpen]);

  // ── Toast ──
  const showToast = useCallback((msg: string, color: string = '#00e5ff') => {
    setToastMsg(msg);
    setToastColor(color);
    setToastVisible(true);
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setToastVisible(false));
    }, 2800);
  }, []);

  // ── Handle messages FROM WebView TO React Native ──
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      const { action, payload } = data;

      switch (action) {
        case 'STATS_UPDATE':
          setStats(payload);
          break;
        case 'TRADE_CLOSED':
          setTrades(prev => [payload.trade, ...prev]);
          setPosition(null);
          showToast(
            `Closed: ${payload.trade.pips > 0 ? '+' : ''}${payload.trade.pips} pips | ${payload.trade.usdPnl >= 0 ? '+$' : '-$'}${Math.abs(payload.trade.usdPnl).toFixed(2)}`,
            payload.trade.win ? '#00e676' : '#ff1744'
          );
          break;
        case 'TRADE_OPENED':
          setPosition({ type: payload.type, price: payload.price, lot: payload.lotSize });
          showToast(`${payload.type} ${payload.lotSize} lot @ ${payload.price.toFixed(5)}`, payload.type === 'BUY' ? '#00e676' : '#ff1744');
          break;
        case 'POSITION_CLOSED':
          setPosition(null);
          break;
        case 'PRICE_UPDATE':
          setCurrentPrice(payload.price);
          setPriceChange(payload.change);
          setPriceChangeColor(payload.changeColor);
          break;
        case 'ASSET_LOADED':
          setCurrentAsset(payload.asset);
          setStatusText(payload.status);
          setStatusColor(payload.statusColor);
          break;
        case 'BAR_COUNTER':
          setStats(prev => ({ ...prev, barCounter: payload.counter }));
          setShowGoto(payload.showGoto);
          break;
        case 'DRAWING_SELECTED':
          setToolSettingsVisible(true);
          setToolColor(payload.color);
          setToolWidth(String(payload.width));
          setToolStyle(payload.style);
          break;
        case 'DRAWING_DESELECTED':
          setToolSettingsVisible(false);
          break;
        case 'TOAST':
          showToast(payload.message, payload.color);
          break;
        case 'ASSET_DB_UPDATE':
          setAssetDB(payload.assetDB);
          break;
        case 'TRADES_CLEARED':
          setTrades([]);
          setPosition(null);
          showToast('Trade history cleared', '#ffab00');
          break;
        case 'APP_READY':
          setTheme(isDark ? 'dark' : 'light');
          break;
        default:
          console.log('Unknown action:', action);
      }
    } catch (e) {
      console.warn('Message parse error:', e);
    }
  }, [isDark, setTheme, showToast]);

  // ── File picker ──
  const pickCSVFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.plainText, DocumentPicker.types.allFiles],
      });
      const file = Array.isArray(result) ? result[0] : result;

      const response = await fetch(file.uri);
      const text = await response.text();

      sendCSVData(text, file.name);
      showToast(`Loading ${file.name}...`, '#00e5ff');
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        showToast('Failed to pick file', '#ff1744');
      }
    }
  }, [sendCSVData, showToast]);

  // ── Tool selection ──
  const handleSetTool = useCallback((tool: string) => {
    setCurrentTool(tool);
    setTool(tool);
    if (tool === 'cursor') {
      setToolSettingsVisible(false);
    } else {
      showToast(tool.toUpperCase() + ' — tap chart to place', '#bb86fc');
    }
  }, [setTool, showToast]);

  // ── Theme toggle ──
  const handleToggleTheme = useCallback(() => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    setTheme(newTheme ? 'dark' : 'light');
  }, [isDark, setTheme]);

  // ── Trade handlers ──
  const handleOpenTrade = useCallback((type: 'BUY' | 'SELL') => {
    if (position) {
      showToast('Close current trade first!', '#ffab00');
      return;
    }
    const lot = parseFloat(lotSize) || 0.1;
    openTrade(type, lot);
  }, [position, lotSize, openTrade, showToast]);

  const handleCloseTrade = useCallback(() => {
    if (!position) {
      showToast('No open trade to close', '#ffab00');
      return;
    }
    closeTrade();
  }, [position, closeTrade, showToast]);

  // ── Timeframe ──
  const timeframes = [
    { label: '1m', value: 1 },
    { label: '5m', value: 5 },
    { label: '15m', value: 15 },
    { label: '1H', value: 60 },
    { label: '4H', value: 240 },
    { label: 'D', value: 1440 },
    { label: 'W', value: 10080 },
    { label: 'M', value: 43200 },
  ];

  const handleTimeframe = useCallback((tf: number) => {
    setSelectedTimeframe(tf);
  }, []);

  // ── Pip settings ──
  const handlePipSizeChange = useCallback((value: string) => {
    setPipSizeState(value);
    setPipSize(parseFloat(value));
  }, [setPipSize]);

  const handlePipValueChange = useCallback((value: string) => {
    setPipValueState(value);
    setPipValue(parseFloat(value));
  }, [setPipValue]);

  // ── Clear handlers ──
  const handleClearTrades = useCallback(() => {
    Alert.alert(
      'Clear Trades',
      'Delete all trade history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => clearTrades() },
      ]
    );
  }, [clearTrades]);

  const handleClearDrawings = useCallback(() => {
    Alert.alert(
      'Clear Drawings',
      'Remove all chart drawings?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => clearDrawings() },
      ]
    );
  }, [clearDrawings]);

  const handleNukeStorage = useCallback(() => {
    Alert.alert(
      'Wipe All Data',
      'This will delete ALL saved data, trades, and assets. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Wipe Everything', 
          style: 'destructive', 
          onPress: async () => {
            await AsyncStorage.clear();
            webViewRef.current?.reload();
            showToast('All data wiped', '#ff1744');
          }
        },
      ]
    );
  }, [webViewRef, showToast]);

  // ── Tool settings update ──
  const handleToolSettingsChange = useCallback(() => {
    postMessageToWeb('UPDATE_TOOL_SETTINGS', {
      color: toolColor,
      width: parseInt(toolWidth),
      style: toolStyle,
    });
  }, [toolColor, toolWidth, toolStyle, postMessageToWeb]);

  // ── Asset list helpers ──
  const toggleCat = useCallback((cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const togglePair = useCallback((key: string) => {
    setExpandedPairs(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const catEmoji = (cat: string) => {
    const map: Record<string, string> = { FOREX: '💱', CRYPTO: '🪙', FUTURES: '📈', COMMODITIES: '🏅' };
    return map[cat] || '📁';
  };

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#090b0f' : '#f0f2f5' }]}>
      {/* ══ HEADER ══ */}
      <View style={[styles.header, { backgroundColor: isDark ? '#0d1117' : '#ffffff', borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
        <Text style={styles.logo}>
          <Text style={{ color: '#00e5ff' }}>BACKTEST</Text>
          <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23' }}>PRO</Text>
        </Text>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
          <TouchableOpacity style={styles.burgerBtn} onPress={() => setDrawerOpen(!drawerOpen)}>
            <View style={[styles.burgerLine, { backgroundColor: isDark ? '#c9d1d9' : '#1a1d23' }]} />
            <View style={[styles.burgerLine, { backgroundColor: isDark ? '#c9d1d9' : '#1a1d23' }]} />
            <View style={[styles.burgerLine, { backgroundColor: isDark ? '#c9d1d9' : '#1a1d23' }]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ TICKER ══ */}
      <View style={[styles.tickerRow, { backgroundColor: isDark ? '#0d1117' : '#ffffff', borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
        <Text style={styles.priceDisplay}>{currentPrice}</Text>
        <View style={[styles.priceChangeBadge, { backgroundColor: priceChangeColor + '20' }]}>
          <Text style={[styles.priceChangeText, { color: priceChangeColor }]}>{priceChange}</Text>
        </View>
        <View style={[styles.assetBadge, { borderColor: '#bb86fc' }]}>
          <Text style={[styles.assetText, { color: '#bb86fc' }]}>{currentAsset}</Text>
        </View>
        {position && (
          <View style={[styles.positionBadge, { 
            backgroundColor: position.type === 'BUY' ? 'rgba(0,230,118,.15)' : 'rgba(255,23,68,.15)',
            borderColor: position.type === 'BUY' ? '#00e676' : '#ff1744'
          }]}>
            <Text style={{ color: position.type === 'BUY' ? '#00e676' : '#ff1744', fontFamily: 'monospace', fontSize: 11 }}>
              {position.type} {position.lot}L @ {position.price.toFixed(5)}
            </Text>
          </View>
        )}
      </View>

      {/* ══ TOOLBAR ══ */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.toolbar, { backgroundColor: isDark ? '#0d1117' : '#ffffff', borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
        <Text style={[styles.toolbarLabel, { color: '#4a5568' }]}>TOOLS</Text>
        {[
          { id: 'cursor', label: '✦ Cursor' },
          { id: 'trendline', label: '╱ Trend' },
          { id: 'hline', label: '— H.Line' },
          { id: 'vline', label: '| V.Line' },
          { id: 'box', label: '▭ Box' },
          { id: 'fib', label: '〜 Fib' },
        ].map(tool => (
          <TouchableOpacity
            key={tool.id}
            style={[styles.toolBtn, {
              borderColor: currentTool === tool.id ? '#00e5ff' : isDark ? '#1a2233' : '#dde1e7',
              backgroundColor: currentTool === tool.id ? 'rgba(0,229,255,.1)' : isDark ? '#111822' : '#f8f9fa',
            }]}
            onPress={() => handleSetTool(tool.id)}
          >
            <Text style={[styles.toolBtnText, { color: currentTool === tool.id ? '#00e5ff' : '#4a5568' }]}>{tool.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.toolBtn, { borderColor: '#ff1744' }]} onPress={handleClearDrawings}>
          <Text style={[styles.toolBtnText, { color: '#ff1744' }]}>✕ Clear</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ══ TOOL SETTINGS BAR ══ */}
      {toolSettingsVisible && (
        <View style={[styles.toolSettingsBar, { backgroundColor: isDark ? '#0a0e16' : '#f0f2f5', borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
          <Text style={[styles.tsLabel, { color: '#00e5ff' }]}>SELECTED</Text>
          <View style={styles.tsGroup}>
            <Text style={[styles.tsLabel, { color: '#4a5568' }]}>Color</Text>
            <TouchableOpacity style={[styles.colorPicker, { backgroundColor: toolColor }]} onPress={() => {
              const colors = ['#00e676', '#00e5ff', '#ff1744', '#ffab00', '#bb86fc', '#3399ff'];
              const idx = colors.indexOf(toolColor);
              const next = colors[(idx + 1) % colors.length];
              setToolColor(next);
              handleToolSettingsChange();
            }} />
          </View>
          <View style={styles.tsGroup}>
            <Text style={[styles.tsLabel, { color: '#4a5568' }]}>Width</Text>
            <TouchableOpacity style={styles.tsSelect} onPress={() => {
              const widths = ['1', '2', '3'];
              const idx = widths.indexOf(toolWidth);
              setToolWidth(widths[(idx + 1) % widths.length]);
              handleToolSettingsChange();
            }}>
              <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 10 }}>
                {toolWidth === '1' ? 'Thin' : toolWidth === '2' ? 'Normal' : 'Thick'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tsGroup}>
            <Text style={[styles.tsLabel, { color: '#4a5568' }]}>Style</Text>
            <TouchableOpacity style={styles.tsSelect} onPress={() => {
              const stylesArr = ['solid', 'dashed', 'dotted'];
              const idx = stylesArr.indexOf(toolStyle);
              setToolStyle(stylesArr[(idx + 1) % stylesArr.length]);
              handleToolSettingsChange();
            }}>
              <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 10 }}>
                {toolStyle}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══ CHART WEBVIEW ══ */}
      <View style={styles.chartContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: 'file:///android_asset/chart.html' }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          originWhitelist={['*']}
          mixedContentMode="always"
          onError={(e) => console.error('WebView error:', e)}
          onLoadEnd={() => {
            setTimeout(() => {
              setTheme(isDark ? 'dark' : 'light');
            }, 500);
          }}
        />
        {showGoto && (
          <TouchableOpacity style={styles.gotoBtn} onPress={gotoLatest}>
            <Text style={{ color: '#00e5ff', fontFamily: 'monospace', fontSize: 11 }}>▶▶ Latest</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ══ CONTROLS ══ */}
      <View style={[styles.controlsPanel, { backgroundColor: isDark ? '#0d1117' : '#ffffff', borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
        <View style={styles.controlRow}>
          <TouchableOpacity style={[styles.navBtn, { backgroundColor: isDark ? '#111822' : '#f8f9fa', borderColor: isDark ? '#1a2233' : '#dde1e7' }]} onPress={prevBar}>
            <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontSize: 16 }}>◀</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navBtn, { backgroundColor: isDark ? '#111822' : '#f8f9fa', borderColor: isDark ? '#1a2233' : '#dde1e7' }]} onPress={nextBar}>
            <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontSize: 16 }}>▶</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tradeBtn, { backgroundColor: 'rgba(0,230,118,.1)', borderColor: '#00e676' }]} onPress={() => handleOpenTrade('BUY')}>
            <Text style={{ color: '#00e676', fontWeight: '700', fontSize: 13 }}>BUY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tradeBtn, { backgroundColor: 'rgba(255,23,68,.1)', borderColor: '#ff1744' }]} onPress={() => handleOpenTrade('SELL')}>
            <Text style={{ color: '#ff1744', fontWeight: '700', fontSize: 13 }}>SELL</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tradeBtn, { backgroundColor: 'rgba(255,171,0,.1)', borderColor: '#ffab00' }]} onPress={handleCloseTrade}>
            <Text style={{ color: '#ffab00', fontWeight: '700', fontSize: 13 }}>CLOSE</Text>
          </TouchableOpacity>
          <View style={styles.lotWrap}>
            <Text style={[styles.lotLabel, { color: '#4a5568' }]}>LOT</Text>
            <TextInput
              style={[styles.lotInput, { 
                backgroundColor: isDark ? '#111822' : '#f8f9fa', 
                borderColor: isDark ? '#1a2233' : '#dde1e7',
                color: '#00e5ff'
              }]}
              value={lotSize}
              onChangeText={setLotSize}
              keyboardType="decimal-pad"
              maxLength={5}
            />
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tfRow}>
          {timeframes.map(tf => (
            <TouchableOpacity
              key={tf.value}
              style={[styles.tfBtn, {
                borderColor: selectedTimeframe === tf.value ? '#00e5ff' : isDark ? '#1a2233' : '#dde1e7',
                backgroundColor: selectedTimeframe === tf.value ? 'rgba(0,229,255,.1)' : isDark ? '#111822' : '#f8f9fa',
              }]}
              onPress={() => handleTimeframe(tf.value)}
            >
              <Text style={{ color: selectedTimeframe === tf.value ? '#00e5ff' : '#4a5568', fontFamily: 'monospace', fontSize: 11 }}>{tf.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ══ STATS GRID ══ */}
      <View style={[styles.statsGrid, { backgroundColor: isDark ? '#1a2233' : '#dde1e7' }]}>
        <View style={[styles.statCell, { backgroundColor: isDark ? '#0d1117' : '#ffffff' }]}>
          <Text style={[styles.statLabel, { color: '#4a5568' }]}>Open P&L (pips)</Text>
          <Text style={[styles.statValue, { color: stats.openPnlPips.startsWith('+') || stats.openPnlPips === '—' ? '#00e5ff' : '#ff1744' }]}>{stats.openPnlPips}</Text>
        </View>
        <View style={[styles.statCell, { backgroundColor: isDark ? '#0d1117' : '#ffffff' }]}>
          <Text style={[styles.statLabel, { color: '#4a5568' }]}>Open P&L ($)</Text>
          <Text style={[styles.statValue, { color: stats.openPnlUsd.startsWith('+') || stats.openPnlUsd === '—' ? '#00e5ff' : '#ff1744' }]}>{stats.openPnlUsd}</Text>
        </View>
        <View style={[styles.statCell, { backgroundColor: isDark ? '#0d1117' : '#ffffff' }]}>
          <Text style={[styles.statLabel, { color: '#4a5568' }]}>Total P&L ($)</Text>
          <Text style={[styles.statValue, { color: stats.totalPnl >= 0 ? '#00e676' : '#ff1744' }]}>
            {stats.totalPnl >= 0 ? '+$' : '-$'}{Math.abs(stats.totalPnl).toFixed(2)}
          </Text>
        </View>
        <View style={[styles.statCell, { backgroundColor: isDark ? '#0d1117' : '#ffffff' }]}>
          <Text style={[styles.statLabel, { color: '#4a5568' }]}>Win Rate</Text>
          <Text style={[styles.statValue, { color: parseFloat(stats.winRate) >= 50 ? '#00e676' : '#ff1744' }]}>{stats.winRate}</Text>
        </View>
        <View style={[styles.statCell, { backgroundColor: isDark ? '#0d1117' : '#ffffff' }]}>
          <Text style={[styles.statLabel, { color: '#4a5568' }]}>Trades</Text>
          <Text style={[styles.statValue, { color: isDark ? '#c9d1d9' : '#1a1d23' }]}>{stats.tradeCount}</Text>
        </View>
        <View style={[styles.statCell, { backgroundColor: isDark ? '#0d1117' : '#ffffff' }]}>
          <Text style={[styles.statLabel, { color: '#4a5568' }]}>Bar</Text>
          <Text style={[styles.statValue, { color: '#00e5ff' }]}>{stats.barCounter}</Text>
        </View>
      </View>

      {/* ══ TRADE LOG ══ */}
      <View style={[styles.logHeader, { backgroundColor: isDark ? '#0d1117' : '#ffffff', borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
        <Text style={[styles.logTitle, { color: '#4a5568' }]}>Recent Trades</Text>
        <TouchableOpacity onPress={handleClearTrades}>
          <Text style={{ color: '#4a5568', fontFamily: 'monospace', fontSize: 9 }}>CLEAR</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={[styles.tradeLog, { backgroundColor: isDark ? '#090b0f' : '#f0f2f5' }]}>
        {trades.length === 0 ? (
          <Text style={[styles.emptyLog, { color: '#4a5568' }]}>No trades yet. Use BUY / SELL to begin.</Text>
        ) : (
          trades.slice(0, 20).map(trade => (
            <View key={trade.id} style={[styles.tradeRow, { borderColor: isDark ? '#0d1117' : '#f0f2f5' }]}>
              <Text style={[styles.tradeNum, { color: '#4a5568' }]}>#{trade.id}</Text>
              <Text style={{ color: trade.type === 'BUY' ? '#00e676' : '#ff1744', fontFamily: 'monospace', fontSize: 11, width: 40 }}>{trade.type}</Text>
              <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 11, flex: 1 }}>{trade.entryPrice.toFixed(5)}</Text>
              <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 11, flex: 1 }}>{trade.exitPrice.toFixed(5)}</Text>
              <Text style={{ color: trade.win ? '#00e676' : '#ff1744', fontFamily: 'monospace', fontSize: 11, width: 70, textAlign: 'right' }}>
                {trade.usdPnl >= 0 ? '+' : ''}${trade.usdPnl.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* ══ DRAWER OVERLAY ══ */}
      {drawerOpen && (
        <Animated.View
          style={[styles.drawerOverlay, { opacity: overlayAnim }]}
          pointerEvents={drawerOpen ? 'auto' : 'none'}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setDrawerOpen(false)} />
        </Animated.View>
      )}

      {/* ══ SIDE DRAWER ══ */}
      <Animated.View
        style={[styles.drawer, {
          transform: [{ translateX: drawerAnim }],
          backgroundColor: isDark ? '#0d1117' : '#ffffff',
          borderColor: isDark ? '#1a2233' : '#dde1e7',
        }]}
      >
        {/* Drawer Header */}
        <View style={[styles.drawerHeader, { backgroundColor: isDark ? '#0d1117' : '#ffffff', borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
          <Text style={styles.drawerTitle}>MENU</Text>
          <TouchableOpacity style={styles.drawerClose} onPress={() => setDrawerOpen(false)}>
            <Text style={{ color: '#4a5568', fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Drawer Tabs */}
        <View style={[styles.drawerTabs, { borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
          {[
            { id: 'settings' as const, label: '⚙ Settings' },
            { id: 'journal' as const, label: '📓 Journal' },
            { id: 'assets' as const, label: '📊 Assets' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.drawerTab, {
                borderBottomColor: activeTab === tab.id ? '#00e5ff' : 'transparent',
              }]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={{ color: activeTab === tab.id ? '#00e5ff' : '#4a5568', fontFamily: 'monospace', fontSize: 10 }}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Drawer Content */}
        <ScrollView style={styles.drawerBody}>
          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <View style={{ padding: 16 }}>
              <Text style={[styles.settingSection, { color: '#4a5568' }]}>Appearance</Text>
              <View style={[styles.settingRow, { borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
                <View>
                  <Text style={[styles.settingLabel, { color: isDark ? '#c9d1d9' : '#1a1d23' }]}>Dark / Light Mode</Text>
                  <Text style={[styles.settingSub, { color: '#4a5568' }]}>Toggle chart theme</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, { backgroundColor: isDark ? '#1a2233' : '#dde1e7' }]}
                  onPress={handleToggleTheme}
                >
                  <View style={[styles.toggleKnob, { 
                    backgroundColor: isDark ? '#00e5ff' : '#0077cc',
                    transform: [{ translateX: isDark ? 0 : 20 }]
                  }]} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.settingSection, { color: '#4a5568' }]}>Trading</Text>
              <View style={[styles.settingRow, { borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
                <View>
                  <Text style={[styles.settingLabel, { color: isDark ? '#c9d1d9' : '#1a1d23' }]}>Pip Size</Text>
                  <Text style={[styles.settingSub, { color: '#4a5568' }]}>Per asset type</Text>
                </View>
                <TouchableOpacity style={[styles.settingSelect, { backgroundColor: isDark ? '#111822' : '#f8f9fa', borderColor: isDark ? '#1a2233' : '#dde1e7' }]} onPress={() => {
                  const sizes = ['0.0001', '0.01', '0.1', '1.0'];
                  const idx = sizes.indexOf(pipSize);
                  const next = sizes[(idx + 1) % sizes.length];
                  setPipSizeState(next);
                  setPipSize(parseFloat(next));
                }}>
                  <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 11 }}>
                    {pipSize === '0.0001' ? 'Forex' : pipSize === '0.01' ? 'JPY' : pipSize === '0.1' ? 'Indices' : 'Crypto'} ({pipSize})
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.settingRow, { borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
                <View>
                  <Text style={[styles.settingLabel, { color: isDark ? '#c9d1d9' : '#1a1d23' }]}>Pip Value / Lot</Text>
                  <Text style={[styles.settingSub, { color: '#4a5568' }]}>USD value per pip per lot</Text>
                </View>
                <TouchableOpacity style={[styles.settingSelect, { backgroundColor: isDark ? '#111822' : '#f8f9fa', borderColor: isDark ? '#1a2233' : '#dde1e7' }]} onPress={() => {
                  const vals = ['10', '1', '5', '25'];
                  const idx = vals.indexOf(pipValue);
                  const next = vals[(idx + 1) % vals.length];
                  setPipValueState(next);
                  setPipValue(parseFloat(next));
                }}>
                  <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 11 }}>${pipValue}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.settingSection, { color: '#4a5568' }]}>Data</Text>
              <View style={[styles.settingRow, { borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
                <View>
                  <Text style={[styles.settingLabel, { color: isDark ? '#c9d1d9' : '#1a1d23' }]}>Load CSV File</Text>
                  <Text style={[styles.settingSub, { color: '#4a5568' }]}>Select file from device</Text>
                </View>
                <TouchableOpacity style={[styles.toolBtn, { borderColor: isDark ? '#1a2233' : '#dde1e7' }]} onPress={pickCSVFile}>
                  <Text style={{ color: '#00e5ff', fontFamily: 'monospace', fontSize: 11 }}>⬆ Browse</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.settingRow, { borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
                <View>
                  <Text style={[styles.settingLabel, { color: isDark ? '#c9d1d9' : '#1a1d23' }]}>Clear All Data</Text>
                  <Text style={[styles.settingSub, { color: '#4a5568' }]}>Wipe everything</Text>
                </View>
                <TouchableOpacity style={[styles.toolBtn, { borderColor: '#ff1744' }]} onPress={handleNukeStorage}>
                  <Text style={{ color: '#ff1744', fontFamily: 'monospace', fontSize: 11 }}>✕ Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* JOURNAL TAB */}
          {activeTab === 'journal' && (
            <View style={{ padding: 16 }}>
              {trades.length === 0 ? (
                <Text style={[styles.journalEmpty, { color: '#4a5568' }]}>No trades recorded yet.
Complete a trade to see it here.</Text>
              ) : (
                trades.map(trade => (
                  <View key={trade.id} style={[styles.journalEntry, { backgroundColor: isDark ? '#111822' : '#f8f9fa', borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
                    <View style={styles.journalEntryHeader}>
                      <Text style={{ color: trade.type === 'BUY' ? '#00e676' : '#ff1744', fontFamily: 'monospace', fontSize: 11, fontWeight: '700' }}>{trade.type}</Text>
                      <Text style={{ color: '#00e5ff', fontFamily: 'monospace', fontSize: 10 }}>{trade.asset || '—'}</Text>
                      <Text style={{ color: '#4a5568', fontFamily: 'monospace', fontSize: 9 }}>{trade.date || ''}</Text>
                      <Text style={{ color: trade.win ? '#00e676' : '#ff1744', fontFamily: 'monospace', fontSize: 12, marginLeft: 'auto' }}>
                        {trade.usdPnl >= 0 ? '+' : ''}${trade.usdPnl.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.journalEntryBody}>
                      <View style={styles.jeDetailGrid}>
                        <View>
                          <Text style={{ color: '#4a5568', fontFamily: 'monospace', fontSize: 9 }}>Entry</Text>
                          <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 10 }}>{trade.entryPrice.toFixed(5)}</Text>
                        </View>
                        <View>
                          <Text style={{ color: '#4a5568', fontFamily: 'monospace', fontSize: 9 }}>Exit</Text>
                          <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 10 }}>{trade.exitPrice.toFixed(5)}</Text>
                        </View>
                        <View>
                          <Text style={{ color: '#4a5568', fontFamily: 'monospace', fontSize: 9 }}>Pips</Text>
                          <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 10 }}>{trade.pips > 0 ? '+' : ''}{trade.pips}</Text>
                        </View>
                        <View>
                          <Text style={{ color: '#4a5568', fontFamily: 'monospace', fontSize: 9 }}>Lot Size</Text>
                          <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 10 }}>{trade.lotSize}</Text>
                        </View>
                      </View>
                      <Text style={{ color: '#4a5568', fontFamily: 'monospace', fontSize: 9, marginTop: 8, marginBottom: 4 }}>TRADE NOTES</Text>
                      <TextInput
                        style={[styles.jeNote, { 
                          backgroundColor: isDark ? '#0d1117' : '#ffffff', 
                          borderColor: isDark ? '#1a2233' : '#dde1e7',
                          color: isDark ? '#c9d1d9' : '#1a1d23'
                        }]}
                        multiline
                        numberOfLines={3}
                        defaultValue={trade.note || ''}
                        placeholder="Write your analysis..."
                        placeholderTextColor="#4a5568"
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ASSETS TAB */}
          {activeTab === 'assets' && (
            <View style={{ padding: 16 }}>
              {Object.entries(assetDB).length === 0 ? (
                <Text style={[styles.journalEmpty, { color: '#4a5568' }]}>No assets loaded yet.
Upload CSV files to get started.</Text>
              ) : (
                Object.entries(assetDB).map(([cat, pairs]) => {
                  const totalDatasets = Object.values(pairs).reduce((s, arr) => s + arr.length, 0);
                  return (
                    <View key={cat} style={{ marginBottom: 16 }}>
                      <TouchableOpacity
                        style={[styles.assetCatHeader, { backgroundColor: isDark ? '#111822' : '#f8f9fa', borderColor: isDark ? '#1a2233' : '#dde1e7' }]}
                        onPress={() => toggleCat(cat)}
                      >
                        <Text style={{ color: '#00e5ff', fontFamily: 'monospace', fontSize: 11 }}>{catEmoji(cat)} {cat}</Text>
                        <Text style={{ color: '#4a5568', fontFamily: 'monospace', fontSize: 10 }}>
                          {totalDatasets > 0 ? `${totalDatasets} dataset(s)` : ''} {expandedCats[cat] ? '▼' : '▶'}
                        </Text>
                      </TouchableOpacity>
                      {expandedCats[cat] && (
                        <View style={[styles.assetCatBody, { borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
                          {Object.entries(pairs).map(([pair, datasets]) => {
                            const pairKey = `${cat}-${pair}`;
                            return (
                              <View key={pair}>
                                <TouchableOpacity
                                  style={[styles.assetPairHeader, { borderColor: isDark ? '#1a2233' : '#dde1e7' }]}
                                  onPress={() => togglePair(pairKey)}
                                >
                                  <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 11, fontWeight: '700' }}>{pair}</Text>
                                  <Text style={{ color: '#4a5568', fontFamily: 'monospace', fontSize: 9 }}>{datasets.length ? `${datasets.length} file(s)` : ''}</Text>
                                  <Text style={{ color: '#4a5568', fontSize: 9 }}>{expandedPairs[pairKey] ? '▼' : '▶'}</Text>
                                </TouchableOpacity>
                                {expandedPairs[pairKey] && (
                                  <View>
                                    {datasets.length === 0 ? (
                                      <Text style={{ padding: 8, color: '#4a5568', fontFamily: 'monospace', fontSize: 10, fontStyle: 'italic' }}>⚠ No data uploaded yet</Text>
                                    ) : (
                                      datasets.map((ds: AssetDataset) => (
                                        <View key={ds.id} style={[styles.assetDataset, { borderColor: isDark ? '#1a2233' : '#dde1e7' }]}>
                                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#00e676' }} />
                                          <TouchableOpacity style={{ flex: 1 }} onPress={() => loadDataset(ds.id, pair)}>
                                            <Text style={{ color: isDark ? '#c9d1d9' : '#1a1d23', fontFamily: 'monospace', fontSize: 10 }}>
                                              {ds.yearRange} — {ds.label}
                                            </Text>
                                          </TouchableOpacity>
                                          <Text style={{ color: '#4a5568', fontFamily: 'monospace', fontSize: 9 }}>{ds.barCount.toLocaleString()} bars</Text>
                                          <TouchableOpacity onPress={() => deleteDataset(cat, pair, ds.id)}>
                                            <Text style={{ color: '#4a5568', fontSize: 10 }}>🗑</Text>
                                          </TouchableOpacity>
                                        </View>
                                      ))
                                    )}
                                    <TouchableOpacity style={[styles.assetUploadBtn, { borderColor: isDark ? '#1a2233' : '#dde1e7' }]} onPress={pickCSVFile}>
                                      <Text style={{ color: '#00e5ff', fontFamily: 'monospace', fontSize: 10 }}>⬆ Upload CSV for {pair}</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* ══ TOAST ══ */}
      {toastVisible && (
        <Animated.View
          style={[styles.toast, {
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
            opacity: toastAnim,
            borderColor: toastColor,
            backgroundColor: isDark ? '#111822' : '#ffffff',
          }]}
        >
          <Text style={{ color: toastColor, fontFamily: 'monospace', fontSize: 12 }}>{toastMsg}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════
//  STYLES
// ════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  logo: { fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
  },
  statusText: { fontFamily: 'monospace', fontSize: 10 },
  burgerBtn: {
    width: 36,
    height: 36,
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1a2233',
    justifyContent: 'center',
    gap: 5,
  },
  burgerLine: { height: 2, borderRadius: 2, width: '100%' },

  // Ticker
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  priceDisplay: { fontFamily: 'monospace', fontSize: 22, color: '#00e5ff', letterSpacing: 1 },
  priceChangeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  priceChangeText: { fontFamily: 'monospace', fontSize: 12 },
  assetBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3, borderWidth: 1 },
  assetText: { fontFamily: 'monospace', fontSize: 10 },
  positionBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    maxHeight: 44,
  },
  toolbarLabel: { fontFamily: 'monospace', fontSize: 10, marginRight: 8, alignSelf: 'center' },
  toolBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 4,
  },
  toolBtnText: { fontFamily: 'monospace', fontSize: 11 },

  // Tool Settings
  toolSettingsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  tsLabel: { fontFamily: 'monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  tsGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  colorPicker: { width: 28, height: 22, borderRadius: 3, borderWidth: 1, borderColor: '#1a2233' },
  tsSelect: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#1a2233',
  },

  // Chart
  chartContainer: { flex: 1, position: 'relative' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  gotoBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00e5ff',
    backgroundColor: '#0d1117',
  },

  // Controls
  controlsPanel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  tradeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  lotWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  lotLabel: { fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase' },
  lotInput: {
    width: 80,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    textAlign: 'center',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  tfRow: {
    flexDirection: 'row',
    marginTop: 8,
    maxHeight: 36,
  },
  tfBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 4,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    borderTopWidth: 1,
  },
  statCell: {
    width: (SCREEN_W - 1) / 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: { fontFamily: 'monospace', fontSize: 16 },

  // Trade Log
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  logTitle: { fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: 2 },
  tradeLog: { maxHeight: 120 },
  emptyLog: {
    textAlign: 'center',
    paddingVertical: 24,
    fontFamily: 'monospace',
    fontSize: 11,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  tradeNum: { fontFamily: 'monospace', fontSize: 11, width: 30 },

  // Drawer
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 400,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: DRAWER_W,
    height: '100%',
    zIndex: 500,
    borderLeftWidth: 1,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  drawerTitle: { fontFamily: 'monospace', fontSize: 13, color: '#00e5ff', letterSpacing: 2 },
  drawerClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1a2233',
    borderRadius: 4,
  },
  drawerTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  drawerTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  drawerBody: { flex: 1 },

  // Settings
  settingSection: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingLabel: { fontFamily: 'monospace', fontSize: 11 },
  settingSub: { fontFamily: 'monospace', fontSize: 9, marginTop: 2 },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 24,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  settingSelect: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },

  // Journal
  journalEmpty: {
    textAlign: 'center',
    paddingVertical: 40,
    fontFamily: 'monospace',
    fontSize: 11,
  },
  journalEntry: {
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  journalEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  journalEntryBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: '#1a2233',
  },
  jeDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 10,
  },
  jeNote: {
    width: '100%',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    fontFamily: 'monospace',
    fontSize: 11,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // Assets
  assetCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
  },
  assetCatBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  assetPairHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  assetDataset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  assetUploadBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: [{ translateX: -150 }],
    width: 300,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    zIndex: 999,
  },
});
