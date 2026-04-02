import { Platform } from 'react-native';
import { ReactNode, createElement } from 'react';

type Props = {
  label: string;
  children: ReactNode;
};

export default function Tooltip({ label, children }: Props) {
  if (Platform.OS === 'web') {
    return createElement('span', { title: label, 'data-hover': 'icon', style: { display: 'inline-flex' } }, children);
  }
  return <>{children}</>;
}
