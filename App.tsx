import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider, MD3DarkTheme } from 'react-native-paper';

import BacktestScreen from './src/screens/BacktestScreen';

const Stack = createNativeStackNavigator();

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#00e5ff',
    secondary: '#00e676',
    background: '#090b0f',
    surface: '#0d1117',
    error: '#ff1744',
    onSurface: '#c9d1d9',
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Backtest" component={BacktestScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
