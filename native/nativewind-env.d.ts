/// <reference types="nativewind/types" />

// Extend React Native types to include className
import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface FlatListProps<T> {
    className?: string;
  }
  interface KeyboardAvoidingViewProps {
    className?: string;
  }
  interface ActivityIndicatorProps {
    className?: string;
  }
  interface RefreshControlProps {
    className?: string;
  }
  interface ModalProps {
    className?: string;
  }
}

declare module 'react-native-safe-area-context' {
  interface SafeAreaViewProps {
    className?: string;
  }
}

declare module 'react-native-gesture-handler' {
  interface GestureHandlerRootViewProps {
    className?: string;
  }
}
