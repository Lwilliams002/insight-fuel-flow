# Titan Prime CRM - React Native App

A native mobile application for iOS and Android, built with React Native and Expo.

## Features

- **Native Maps**: Uses Apple Maps on iOS and Google Maps on Android
- **Native Performance**: Fast loading times and smooth animations
- **Offline Support**: Works offline with data syncing
- **Push Notifications**: Native push notifications
- **Camera & Photos**: Native camera integration for property photos
- **Secure Storage**: Biometric authentication support

## Tech Stack

- **Framework**: React Native with Expo SDK 54
- **Navigation**: Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: TanStack Query + Zustand
- **Authentication**: AWS Cognito
- **Maps**: react-native-maps (Apple Maps/Google Maps)
- **Icons**: Lucide React Native

## Project Structure

```
native/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   │   └── login.tsx
│   ├── (rep)/             # Rep screens (tab navigator)
│   │   ├── dashboard.tsx
│   │   ├── deals/
│   │   ├── map.tsx
│   │   ├── calendar.tsx
│   │   └── profile.tsx
│   ├── (admin)/           # Admin screens (tab navigator)
│   │   ├── dashboard.tsx
│   │   ├── deals.tsx
│   │   ├── map.tsx
│   │   ├── reps.tsx
│   │   └── settings.tsx
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Entry redirect
├── src/
│   ├── components/
│   │   └── ui/            # Reusable UI components
│   ├── contexts/          # React contexts (Auth, etc.)
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities
│   ├── services/          # API services
│   └── constants/         # Configuration
├── assets/                # Images, fonts
└── app.json              # Expo config
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS: Xcode 15+ (Mac only)
- Android: Android Studio with SDK

### Installation

1. Install dependencies:
```bash
cd native
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your AWS credentials:
```env
EXPO_PUBLIC_AWS_REGION=us-east-1
EXPO_PUBLIC_COGNITO_USER_POOL_ID=your-pool-id
EXPO_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=your-client-id
EXPO_PUBLIC_API_URL=https://your-api-url.amazonaws.com
```

### Development

Start the development server:
```bash
npm start
```

Run on iOS Simulator:
```bash
npm run ios
```

Run on Android Emulator:
```bash
npm run android
```

### Building for Production

#### Install EAS CLI:
```bash
npm install -g eas-cli
eas login
```

#### Configure EAS:
```bash
eas build:configure
```

#### Build for iOS:
```bash
eas build --platform ios
```

#### Build for Android:
```bash
eas build --platform android
```

#### Submit to App Store:
```bash
eas submit --platform ios
```

#### Submit to Google Play:
```bash
eas submit --platform android
```

## Testing on Devices

### iOS Simulator (Mac only)
```bash
npm run ios
```

### Android Emulator
```bash
npm run android
```

### Physical Device (Expo Go)
1. Install Expo Go from App Store/Play Store
2. Run `npm start`
3. Scan the QR code with your device

### Physical Device (Development Build)
For features that require native code (like maps):
```bash
npx expo prebuild
npx expo run:ios --device
npx expo run:android --device
```

## App Store Submission Checklist

### iOS (App Store)
- [ ] Apple Developer Account ($99/year)
- [ ] App Icons (1024x1024)
- [ ] Screenshots for all device sizes
- [ ] App Privacy Policy URL
- [ ] App Store description
- [ ] Keywords
- [ ] Support URL

### Android (Google Play)
- [ ] Google Play Developer Account ($25 one-time)
- [ ] App Icons (512x512)
- [ ] Feature Graphic (1024x500)
- [ ] Screenshots
- [ ] Privacy Policy URL
- [ ] Content rating questionnaire

## Environment Variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_AWS_REGION` | AWS region |
| `EXPO_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `EXPO_PUBLIC_COGNITO_USER_POOL_CLIENT_ID` | Cognito Client ID |
| `EXPO_PUBLIC_API_URL` | API Gateway URL |
| `EXPO_PUBLIC_S3_BUCKET` | S3 bucket name |

## Troubleshooting

### Metro Bundler Issues
```bash
npx expo start --clear
```

### iOS Build Issues
```bash
cd ios && pod install && cd ..
```

### Android Build Issues
```bash
cd android && ./gradlew clean && cd ..
```

## License

Proprietary - Titan Prime Solutions
