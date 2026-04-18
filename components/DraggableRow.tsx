import { View, Platform, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';
import { useRef, useEffect, ReactNode } from 'react';

type Props = {
  index: number;
  dragType: string;
  onReorder: (from: number, to: number) => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

// Shared state across all DraggableRow instances of the same dragType
const dragState: Record<string, { from: number | null; type: string | null }> = {};

export default function DraggableRow({ index, dragType, onReorder, style, children }: Props) {
  const colors = useThemeColors();
  const ref = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !ref.current) return;

    // Access the underlying DOM element
    const el = ref.current as unknown as HTMLElement;
    if (!el || !el.addEventListener) return;

    // Only enable drag on desktop — on mobile/touch devices it interferes with taps
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;

    el.draggable = true;
    el.style.cursor = 'default';

    const onDragStart = (e: DragEvent) => {
      dragState[dragType] = { from: index, type: dragType };
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
      }
      el.style.opacity = '0.5';
    };

    const onDragEnd = () => {
      el.style.opacity = '1';
      el.style.outline = '';
      dragState[dragType] = { from: null, type: null };
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      const state = dragState[dragType];
      if (state?.from !== null && state?.from !== index) {
        el.style.outline = `2px dashed ${colors.primary}`;
        el.style.outlineOffset = '-2px';
        el.style.borderRadius = '10px';
      }
    };

    const onDragLeave = () => {
      el.style.outline = '';
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      el.style.outline = '';
      const state = dragState[dragType];
      if (state?.from !== null && state.from !== index) {
        onReorder(state.from, index);
      }
      dragState[dragType] = { from: null, type: null };
    };

    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend', onDragEnd);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);

    return () => {
      el.removeEventListener('dragstart', onDragStart);
      el.removeEventListener('dragend', onDragEnd);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [index, dragType, onReorder]);

  return (
    <View ref={ref} style={style}>
      {children}
    </View>
  );
}
