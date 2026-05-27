import { useRef, useCallback } from 'react';
import { WebView } from 'react-native-webview';

export type BridgeMessage = {
  action: string;
  payload?: any;
};

export function useWebViewBridge() {
  const webViewRef = useRef<WebView>(null);

  // Send message FROM React Native TO WebView
  const postMessageToWeb = useCallback((action: string, payload?: any) => {
    if (!webViewRef.current) return;

    const message: BridgeMessage = { action, payload };
    const js = `
      (function() {
        if (window.onMessageFromRN) {
          window.onMessageFromRN(${JSON.stringify(JSON.stringify(message))});
        }
      })();
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, []);

  // Send CSV data to WebView
  const sendCSVData = useCallback((csvText: string, filename: string) => {
    postMessageToWeb('LOAD_CSV', { csvText, filename });
  }, [postMessageToWeb]);

  // Send tool selection to WebView
  const setTool = useCallback((tool: string) => {
    postMessageToWeb('SET_TOOL', { tool });
  }, [postMessageToWeb]);

  // Send theme to WebView
  const setTheme = useCallback((theme: 'dark' | 'light') => {
    postMessageToWeb('SET_THEME', { theme });
  }, [postMessageToWeb]);

  // Send bar navigation commands
  const nextBar = useCallback(() => {
    postMessageToWeb('NEXT_BAR');
  }, [postMessageToWeb]);

  const prevBar = useCallback(() => {
    postMessageToWeb('PREV_BAR');
  }, [postMessageToWeb]);

  const gotoLatest = useCallback(() => {
    postMessageToWeb('GOTO_LATEST');
  }, [postMessageToWeb]);

  // Send trade commands
  const openTrade = useCallback((type: 'BUY' | 'SELL', lotSize: number) => {
    postMessageToWeb('OPEN_TRADE', { type, lotSize });
  }, [postMessageToWeb]);

  const closeTrade = useCallback(() => {
    postMessageToWeb('CLOSE_TRADE');
  }, [postMessageToWeb]);

  // Send settings
  const setPipSize = useCallback((pipSize: number) => {
    postMessageToWeb('SET_PIP_SIZE', { pipSize });
  }, [postMessageToWeb]);

  const setPipValue = useCallback((pipValue: number) => {
    postMessageToWeb('SET_PIP_VALUE', { pipValue });
  }, [postMessageToWeb]);

  // Clear drawings
  const clearDrawings = useCallback(() => {
    postMessageToWeb('CLEAR_DRAWINGS');
  }, [postMessageToWeb]);

  // Clear trades
  const clearTrades = useCallback(() => {
    postMessageToWeb('CLEAR_TRADES');
  }, [postMessageToWeb]);

  // Load dataset by ID
  const loadDataset = useCallback((id: number, assetName: string) => {
    postMessageToWeb('LOAD_DATASET', { id, assetName });
  }, [postMessageToWeb]);

  // Delete dataset
  const deleteDataset = useCallback((cat: string, pair: string, id: number) => {
    postMessageToWeb('DELETE_DATASET', { cat, pair, id });
  }, [postMessageToWeb]);

  return {
    webViewRef,
    postMessageToWeb,
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
  };
}
