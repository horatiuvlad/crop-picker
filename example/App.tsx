import React, { useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  CropPicker,
  setCropBackend,
  createExpoImageManipulatorBackend,
  type CropPickerRef,
  type CropRegion,
  type CropResult,
} from '@horatiuvlad/crop-picker';

// Native extraction backend, injected once at startup. On web the built-in canvas
// backend is already registered, so this is a no-op there.
if (Platform.OS !== 'web') {
  setCropBackend(createExpoImageManipulatorBackend(ImageManipulator));
}

const PHOTO = 'https://images.unsplash.com/photo-1526779259212-939e64788e3c?w=1600&q=80';

const ASPECTS = [
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '16:9', value: 16 / 9 },
];

export default function App() {
  const cropper = useRef<CropPickerRef>(null);
  const [aspect, setAspect] = useState(1);
  const [round, setRound] = useState(false);
  const [region, setRegion] = useState<CropRegion | null>(null);
  const [result, setResult] = useState<CropResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doCrop = async () => {
    try {
      setError(null);
      const out = await cropper.current?.crop({ format: 'jpeg', quality: 0.92 });
      setResult(out ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <Text style={styles.title}>@horatiuvlad/crop-picker</Text>
      <Text style={styles.subtitle}>
        drag to pan · pinch or double-tap to zoom · same code on iOS, Android & web
      </Text>

      <View style={styles.stage} testID="stage">
        <CropPicker
          ref={cropper}
          source={PHOTO}
          cropArea={{ aspect, inset: 20 }}
          round={round}
          onCropChange={setRegion}
          onError={(e) => setError(e.message)}
          style={styles.cropper}
          testID="cropper"
        />
      </View>

      <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false}>
        {ASPECTS.map((a) => (
          <Button
            key={a.label}
            label={a.label}
            active={!round && aspect === a.value}
            onPress={() => {
              setRound(false);
              setAspect(a.value);
            }}
          />
        ))}
        <Button label="round" active={round} onPress={() => setRound((r) => !r)} />
        <Button label="⟲" onPress={() => cropper.current?.rotate90(false)} />
        <Button label="⟳" onPress={() => cropper.current?.rotate90(true)} />
        <Button label="reset" onPress={() => cropper.current?.reset()} />
      </ScrollView>

      <View style={styles.row}>
        <Button label="Crop" primary onPress={doCrop} testID="crop-button" />
      </View>

      <Text style={styles.mono} testID="region">
        {region
          ? `rot ${region.rotationDeg}°  rect ${region.rect.width}×${region.rect.height} @ ${region.rect.x},${region.rect.y}`
          : 'measuring…'}
      </Text>

      {error ? (
        <Text style={[styles.mono, styles.error]} testID="error">
          {error}
        </Text>
      ) : null}

      {result ? (
        <View style={styles.resultBox} testID="result">
          <Image source={{ uri: result.uri }} style={styles.resultImage} resizeMode="contain" />
          <Text style={styles.mono}>
            {result.width}×{result.height}
            {result.mimeType ? ` · ${result.mimeType}` : ''}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Button({
  label,
  onPress,
  active,
  primary,
  testID,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  primary?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        active && styles.buttonActive,
        primary && styles.buttonPrimary,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0d10', padding: 16, gap: 10 },
  title: { color: '#f2f5f8', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#8b97a5', fontSize: 12, textAlign: 'center' },
  stage: { flex: 1, minHeight: 320, borderRadius: 16, overflow: 'hidden', backgroundColor: '#15181d' },
  cropper: { flex: 1 },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#1d2229',
    borderWidth: 1,
    borderColor: '#2a3039',
  },
  buttonActive: { backgroundColor: '#2b3542', borderColor: '#4b7fd4' },
  buttonPrimary: { backgroundColor: '#4b7fd4', borderColor: '#4b7fd4', paddingHorizontal: 28 },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#d7dee7', fontWeight: '600', fontSize: 14 },
  buttonTextPrimary: { color: '#fff' },
  mono: {
    color: '#8b97a5',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  error: { color: '#ff8080' },
  resultBox: { alignItems: 'center', gap: 6 },
  resultImage: { width: 140, height: 140, borderRadius: 10, backgroundColor: '#15181d' },
});
