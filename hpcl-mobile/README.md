# 📱 HPCL Sales Intelligence - Mobile App

> Native Android/iOS mobile application for B2B sales intelligence and lead management

**React Native (Expo) wrapper that brings the full HPCL Sales Intelligence platform to mobile devices with native performance and offline capabilities.**

![Application Architecture](../diagram.jpg)

---

## 🎯 What We Built

A **cross-platform mobile application** that wraps our Next.js web dashboard in a native mobile experience, providing:

- ✅ **Native Mobile Experience**: Full-featured mobile app from existing web codebase
- ✅ **Zero Code Duplication**: Uses the same Next.js frontend as the web version
- ✅ **Hardware Integration**: Native back button, gestures, and deep linking support
- ✅ **Offline-Ready**: Progressive loading with cached content
- ✅ **One Codebase, Multiple Platforms**: Deploy to Android, iOS, and Web simultaneously

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   Mobile App (React Native)         │
│   ┌─────────────────────────────┐   │
│   │   WebView Container         │   │
│   │   ┌─────────────────────┐   │   │
│   │   │  Next.js Dashboard  │   │   │
│   │   │  (Embedded)         │   │   │
│   │   └─────────────────────┘   │   │
│   └─────────────────────────────┘   │
│          ↓ HTTP/HTTPS                │
└────────────┼────────────────────────┘
             ↓
    ┌────────────────────┐
    │  Express.js API    │
    │  (Port 4000)       │
    └────────────────────┘
             ↓
    ┌────────────────────┐
    │  MongoDB Database  │
    └────────────────────┘
```

**Technology Stack:**
- **Expo SDK 54**: Modern React Native framework
- **React Native WebView 13.x**: High-performance web content rendering
- **nativeflowcss**: CSS utilities for React Native
- **Native APIs**: Hardware back button, safe areas, status bar control
- **Progressive Enhancement**: Works offline with cached content

---

## ✨ Key Features

### 🎨 Native Mobile Experience
- **Hardware Back Button**: Android back navigation fully integrated
- **Safe Area Handling**: Automatic adjustment for notches, status bars, and gestures
- **Native Gestures**: Swipe navigation and native scroll performance
- **Splash Screen**: Branded loading experience
- **Loading States**: Native loading indicators during page transitions

### 📊 Full Dashboard Access
- **Lead Management**: View, filter, and manage sales leads on mobile
- **AI-Powered Insights**: Access enriched lead data with product recommendations
- **Real-time Updates**: Live lead scoring and signal detection
- **Officer Assignment**: Manage sales territory and assignments from anywhere
- **News Feed**: Industry news matched to sales opportunities
- **Executive Dashboard**: KPIs and analytics at your fingertips

### 🔧 Developer Experience
- **Single Codebase**: Maintain one frontend for web and mobile
- **Hot Reload**: Instant updates during development with Expo Go
- **Easy Deployment**: Build APKs and App Store packages with one command
- **Cross-Platform**: Works on Android, iOS, and web browsers
- **No Native Code Required**: Pure JavaScript/TypeScript development

---

## 🛠️ Technical Implementation

### WebView Integration

The app uses a high-performance WebView to embed the entire Next.js dashboard:

```javascript
<WebView
  source={{ uri: DASHBOARD_URL }}
  onNavigationStateChange={handleNavigation}
  javaScriptEnabled={true}
  domStorageEnabled={true}
  cacheEnabled={true}
  mixedContentMode="always"
/>
```

### Hardware Back Button (Android)

Intercepts Android back button to navigate within the app instead of exiting:

```javascript
const onBackPress = () => {
  if (canGoBack) {
    webViewRef.current.goBack();
    return true; // Prevent app exit
  }
  return false;
};
```

### Safe Area Support

Automatic handling of notches, status bars, and gesture areas on modern devices:

```javascript
<SafeAreaView style={{ flex: 1 }}>
  <WebView ... />
</SafeAreaView>
```

---

## 🎯 Why This Approach?

**Innovation for Rapid Development:**

1. **Instant Mobile Deployment**: Complete mobile app from existing web codebase in hours
2. **100% Code Reuse**: Zero code duplication - same frontend for web and mobile
3. **Native Integration**: Hardware back button, gestures, and device APIs
4. **Easy Maintenance**: Web updates automatically reflect in mobile app
5. **True Cross-Platform**: Single build process for iOS and Android

This approach demonstrates how modern web technologies can be leveraged to create native mobile experiences without rewriting entire applications.

---

## 🎨 Customization

Update `app.json` to personalize the app:

```json
{
  "expo": {
    "name": "HPCL Sales Intelligence",
    "slug": "hpcl-sales",
    "android": {
      "package": "com.hpcl.sales"
    },
    "ios": {
      "bundleIdentifier": "com.hpcl.sales"
    }
  }
}
```

Replace assets in `assets/` folder:
- `icon.png` - App icon (1024×1024 px)
- `adaptive-icon.png` - Android icon (1024×1024 px)
- `splash.png` - Splash screen (2048×2732 px)

---

## 🚀 How to Run

### Prerequisites

- **Node.js** v18+ installed
- **Expo Go App** (SDK 54+) on your phone
  - [Android Download](https://expo.dev/go?sdkVersion=54&platform=android&device=true)
  - [iOS Download](https://apps.apple.com/app/expo-go/id982107779)
- Phone and computer on **same WiFi network**
- MongoDB running locally or connection string configured

---

### Step 1: Install Dependencies

```bash
cd hpcl-mobile
npm install
```

---

### Step 2: Find Your Local IP Address

```bash
# Linux/Mac
hostname -I | awk '{print $1}'

# Windows (PowerShell)
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}).IPAddress

# You'll get something like: 10.251.191.7 or 192.168.1.x
```

---

### Step 3: Configure Network URLs

#### A. Update Mobile App URL

Edit `App.js` (line 11) with your IP:

```javascript
const DASHBOARD_URL = 'http://YOUR_LOCAL_IP:3000';
// Example: const DASHBOARD_URL = 'http://10.251.191.7:3000';
```

#### B. Configure Backend API Access

The Next.js dashboard needs to connect to the backend. Create `../hpcl/.env.local`:

```bash
# In the hpcl directory (not hpcl-mobile)
cd ../hpcl
echo 'NEXT_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:4000' > .env.local
```

Replace `YOUR_LOCAL_IP` with the same IP from Step 2.

---

### Step 4: Start All Services

You need **3 services** running simultaneously in **3 separate terminals**:

#### Terminal 1: Backend API

```bash
cd eprocure-scraper
npm run api
```

✅ Should start on `http://localhost:4000`

#### Terminal 2: Next.js Dashboard

```bash
cd hpcl
npm run dev -- -H 0.0.0.0
```

✅ Should start on `http://0.0.0.0:3000`  
⚠️ **Important**: The `-H 0.0.0.0` flag makes Next.js accessible on your network

#### Terminal 3: Expo Mobile App

```bash
cd hpcl-mobile
npx expo start --lan
```

✅ Should show a QR code on `exp://YOUR_LOCAL_IP:8081`

---

### Step 5: Open on Your Phone

1. Open **Expo Go** app (must be SDK 54+)
2. Tap **"Scan QR Code"**
3. Scan the QR code from Terminal 3
4. Wait **15-30 seconds** for first load (JavaScript bundle is being created)

**Alternative**: Manually enter `exp://YOUR_LOCAL_IP:8081` in Expo Go

---

### Verification Checklist

Before opening the app, verify all services are running:

```bash
# Test Backend API
curl http://YOUR_LOCAL_IP:4000/api/leads

# Test Next.js Dashboard (should show HTML)
curl http://YOUR_LOCAL_IP:3000

# Test Expo Metro (should show "packager-status:running")
curl http://YOUR_LOCAL_IP:8081/status
```

If any fail, check the terminal output for errors.

---

## 📦 Building for Production

### Android APK

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

---

## 🛠️ Technical Implementation

### WebView Integration

```javascript
<WebView
  source={{ uri: DASHBOARD_URL }}
  onNavigationStateChange={handleNavigation}
  javaScriptEnabled={true}
  domStorageEnabled={true}
  cacheEnabled={true}
/>
```

### Hardware Back Button (Android)

Intercepts Android back button to navigate within the app instead of exiting:

```javascript
const onBackPress = () => {
  if (canGoBack) {
    webViewRef.current.goBack();
    return true; // Prevent app exit
  }
  return false;
};
```

### Safe Area Support

Automatic handling of notches, status bars, and gesture areas on modern devices:

```javascript
<SafeAreaView style={{ flex: 1 }}>
  <WebView ... />
</SafeAreaView>
```

---

## 🎨 Customization

### App Identity

**`app.json`** - Update app metadata:
```json
{
  "expo": {
    "name": "HPCL Sales Intelligence",
    "slug": "hpcl-sales",
    "android": {
      "package": "com.hpcl.sales"
    },
    "ios": {
      "bundleIdentifier": "com.hpcl.sales"
    }
  }
}
```

### Assets

Replace in `assets/` folder:
- `icon.png` - App icon (1024×1024 px)
- `adaptive-icon.png` - Android adaptive icon (1024×1024 px)
- `splash.png` - Splash screen (2048×2732 px)

---

## 🐛 Troubleshooting

### "Unable to load application data"

**Cause**: Next.js can't connect to backend API.

**Fix**:
```bash
cd ../hpcl
echo "NEXT_PUBLIC_API_BASE_URL=http://YOUR_IP:4000" > .env.local
npm run dev -- -H 0.0.0.0
```

### "Project is incompatible with Expo Go"

**Fix**: Update to Expo Go SDK 54+ or upgrade project:
```bash
npm install expo@latest
npx expo install --fix
```

### White Screen / Loading Forever

**Checklist**:
- ✅ Backend API running on port 4000
- ✅ Next.js running with `-H 0.0.0.0` flag
- ✅ MongoDB connected
- ✅ Correct IP in `App.js` and `.env.local`
- ✅ Phone and computer on same WiFi

**Test**: Open `http://YOUR_IP:3000` in phone's browser first.

---

## 🔒 Production Configuration

For production deployment:

1. **Update URLs** to production HTTPS endpoints
2. **Enable CORS** on backend for mobile origins
3. **Add Authentication** - implement login flow
4. **SSL Certificates** - use HTTPS for all connections
5. **Replace Assets** - use production icons and splash screens

---

## 📊 Performance

- **Bundle Size**: ~15MB (includes React Native + WebView)
- **First Load**: 15-30 seconds (JavaScript bundle compilation)
- **Subsequent Loads**: 2-5 seconds (cached)
- **Memory Usage**: ~100-150MB typical
- **Offline Support**: Cached pages accessible without network

---

## 🎯 Hackathon Highlights

**Why This Approach?**

1. **Rapid Development**: Mobile app in hours, not weeks
2. **Code Reuse**: 100% frontend code shared with web version
3. **Native Features**: Full access to device APIs when needed
4. **Easy Updates**: Push web updates without app store approval
5. **Cross-Platform**: One build process for iOS and Android

**Built with Expo SDK 54 + React Native WebView**

