import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Cropper from 'react-easy-crop';
import { Colors } from '../constants/colors';

type Area = { x: number; y: number; width: number; height: number };

type Props = {
  imageUri: string;
  aspect?: [number, number];
  onCrop: (croppedUri: string) => void;
  onCancel: () => void;
};

async function getCroppedBlob(imageSrc: string, crop: Area): Promise<string> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Canvas is empty')); return; }
        resolve(URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.9
    );
  });
}

export default function ImageCropModal({ imageUri, aspect = [16, 9], onCrop, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedArea) return;
    setProcessing(true);
    try {
      const croppedUri = await getCroppedBlob(imageUri, croppedArea);
      onCrop(croppedUri);
    } catch {
      onCrop(imageUri);
    }
    setProcessing(false);
  }

  if (Platform.OS !== 'web') {
    // On native, expo-image-picker handles cropping — just pass through
    onCrop(imageUri);
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>Crop Image</Text>
        <View style={styles.cropContainer}>
          <Cropper
            image={imageUri}
            crop={crop}
            zoom={zoom}
            aspect={aspect[0] / aspect[1]}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </View>
        <Text style={styles.hint}>Drag to reposition, scroll to zoom</Text>
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={processing}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={processing}>
            {processing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>Crop</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '94%',
    maxWidth: 700,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  cropContainer: {
    position: 'relative',
    width: '100%',
    height: 420,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  hint: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
