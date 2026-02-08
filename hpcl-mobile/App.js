import { StatusBar } from 'expo-status-bar';
import { View, BackHandler, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { flex, w, h } from 'nativeflowcss';
import React, { useRef, useEffect, useState } from 'react';

// ⚠️ IMPORTANT: Update this URL before deploying
// For development: Use your local IP (e.g., http://192.168.1.x:3000)
// For production: Use your deployed URL (e.g., https://hpcl.yourdomain.com)
const DASHBOARD_URL = 'http://10.251.191.7:3000';

export default function App() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);

  const onBackPress = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true; // Prevent default back behavior
    }
    return false; // Allow app to close
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1E3A5F' }}>
      <StatusBar style="light" />
      <View style={[flex.f_1, w.w_('full'), h.h_('full')]}>
        <WebView
          style={[w.w_('full'), h.h_('full')]}
          ref={webViewRef}
          source={{ uri: DASHBOARD_URL }}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
          }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          cacheEnabled={false}
          incognito={false}
          mixedContentMode="always"
          androidHardwareAccelerationDisabled={false}
          renderLoading={() => (
            <View style={[flex.f_1, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E3A5F' }]}>
              <ActivityIndicator size="large" color="#FFA500" />
            </View>
          )}
          // Allow all navigation within the app
          onShouldStartLoadWithRequest={(request) => {
            return true;
          }}
        />
      </View>
    </SafeAreaView>
  );
}

