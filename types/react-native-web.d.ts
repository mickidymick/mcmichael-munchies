import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    dataSet?: Record<string, string>;
  }
  interface TouchableOpacityProps {
    dataSet?: Record<string, string>;
  }
}
