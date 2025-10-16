import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert,
  Platform, Animated, Dimensions, ScrollView, useWindowDimensions, PanResponder } from
'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line } from 'react-native-svg';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Caliper from './components/Caliper';
import Ionicons from '@expo/vector-icons/Ionicons';
import JSZip from 'jszip';

const Stack = createNativeStackNavigator();

const palette = {
  bg: '#0b0f14',
  panel: '#111723',
  text: '#d9e1f2',
  sub: '#8aa0b6',
  neon: '#00e5a8',
  neon2: '#43c7ff',
  danger: '#ff5b6e',
  border: '#1f2b3a'
};

function useScale() {
  const { width, fontScale } = useWindowDimensions();
  const base = 375;
  const scale = width / base;
  const s = useCallback((n) => Math.round(n * scale), [scale]);
  const f = useCallback((n) => Math.round(n * scale / fontScale), [scale, fontScale]);
  return { s, f, width };
}

const CALIBRATORS = [
{ key: 'quarter', label: 'Quarter 24.26 mm', mm: 24.26 },
{ key: 'nickel', label: 'Nickel 21.21 mm', mm: 21.21 },
{ key: 'penny', label: 'Penny 19.05 mm', mm: 19.05 },
{ key: 'dime', label: 'Dime 17.91 mm', mm: 17.91 },
{ key: 'aa', label: 'AA battery 50.50 mm', mm: 50.50 },
{ key: 'card', label: 'ID card width 85.60 mm', mm: 85.60 }];


const DEFAULT_PRESETS = [
{ key: 'bk_socket', label: 'Below-knee test socket', heightMM: 120, thicknessMM: 3.0, flare: 1.06, segments: 96 },
{ key: 'be_socket', label: 'Below-elbow test socket', heightMM: 100, thicknessMM: 3.0, flare: 1.05, segments: 96 },
{ key: 'fa_cuff', label: 'Forearm cuff (support)', heightMM: 60, thicknessMM: 3.0, flare: 1.02, segments: 96 },
{ key: 'cover_ring', label: 'Cosmetic cover ring', heightMM: 20, thicknessMM: 2.0, flare: 1.00, segments: 96 }];


const keyPresets = 'prosthetiscan_presets_v1';
const keyHistory = 'prosthetiscan_history_v2';
const keyOnboard = 'prosthetiscan_onboard_done';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rad2deg = (r) => r * 180 / Math.PI;

function NeonChip({ active, children, onPress, style }) {
  const { s, f } = useScale();
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[{ borderRadius: s(14) }, style]}>
      <LinearGradient
        colors={active ? [palette.neon2, palette.neon] : ['#0e1622', '#0e1622']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.chip, active && { shadowColor: palette.neon, shadowOpacity: 0.4, shadowRadius: s(6) }]}>

        <Text style={[styles.chipText, active && { color: '#001013', fontWeight: '700', fontSize: f(12) }]}>{children}</Text>
      </LinearGradient>
    </TouchableOpacity>);

}

function Corner({ pos = 'tl', size = 28, color = palette.neon }) {
  const { s } = useScale();
  const px = s(size);
  const base = { position: 'absolute', width: px, height: px, borderColor: color, borderWidth: 3 };
  const radius = s(10);
  if (pos === 'tl') return <View style={[base, { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: radius }]} />;
  if (pos === 'tr') return <View style={[base, { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: radius }]} />;
  if (pos === 'bl') return <View style={[base, { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: radius }]} />;
  return <View style={[base, { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: radius }]} />;
}

function ScannerOverlay({ hint = 'Align calibrator near limb', beam = true }) {
  const { height } = Dimensions.get('window');
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!beam) return;
    Animated.loop(
      Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true })]
      )
    ).start();
  }, [beam]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.min(420, height * 0.55)] });
  return (
    <View pointerEvents="none" style={styles.scanFrame}>
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      {beam &&
      <Animated.View style={{ position: 'absolute', top: 10, left: 10, right: 10, transform: [{ translateY }] }}>
          <LinearGradient colors={['transparent', 'rgba(67,199,255,0.25)', 'transparent']} style={{ height: 6, borderRadius: 3 }} />
        </Animated.View>
      }
      <View style={styles.scanHint}>
        <Ionicons name="scan-outline" size={16} color={palette.neon2} />
        <Text style={{ color: palette.text, marginLeft: 6, fontSize: 12 }}>{hint}</Text>
      </View>
    </View>);

}

function Shutter({ onPress, disabled }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.9}>
      <LinearGradient colors={[palette.neon2, palette.neon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.shutter, disabled && { opacity: 0.5 }]}>
        <View style={styles.shutterInner} />
      </LinearGradient>
    </TouchableOpacity>);

}


function toFacet(a, b, c) {
  return `facet normal 0 0 0
  outer loop
    vertex ${a.x.toFixed(5)} ${a.y.toFixed(5)} ${a.z.toFixed(5)}
    vertex ${b.x.toFixed(5)} ${b.y.toFixed(5)} ${b.z.toFixed(5)}
    vertex ${c.x.toFixed(5)} ${c.y.toFixed(5)} ${c.z.toFixed(5)}
  endloop
endfacet
`;
}
function cylindricalRingSTL(name, rinBottom, routBottom, rinTop, routTop, height, segments = 96) {
  const twoPi = Math.PI * 2;
  let stl = `solid ${name}\n`;
  for (let i = 0; i < segments; i++) {
    const a0 = i / segments * twoPi;
    const a1 = (i + 1) / segments * twoPi;

    const cb0 = { x: rinBottom * Math.cos(a0), y: rinBottom * Math.sin(a0), z: 0 };
    const cb1 = { x: rinBottom * Math.cos(a1), y: rinBottom * Math.sin(a1), z: 0 };
    const ct0 = { x: rinTop * Math.cos(a0), y: rinTop * Math.sin(a0), z: height };
    const ct1 = { x: rinTop * Math.cos(a1), y: rinTop * Math.sin(a1), z: height };

    const OB0 = { x: routBottom * Math.cos(a0), y: routBottom * Math.sin(a0), z: 0 };
    const OB1 = { x: routBottom * Math.cos(a1), y: routBottom * Math.sin(a1), z: 0 };
    const OT0 = { x: routTop * Math.cos(a0), y: routTop * Math.sin(a0), z: height };
    const OT1 = { x: routTop * Math.cos(a1), y: routTop * Math.sin(a1), z: height };


    stl += toFacet(OB0, OB1, OT1);
    stl += toFacet(OB0, OT1, OT0);

    stl += toFacet(ct1, cb1, cb0);
    stl += toFacet(ct0, ct1, cb0);

    stl += toFacet(ct0, ct1, OT1);
    stl += toFacet(ct0, OT1, OT0);

    stl += toFacet(OB0, OB1, cb1);
    stl += toFacet(OB0, cb1, cb0);
  }
  stl += `endsolid ${name}\n`;
  return stl;
}


class ErrorBoundary extends React.Component {
  constructor(p) {super(p);this.state = { hasError: false, err: null };}
  static getDerivedStateFromError(err) {return { hasError: true, err };}
  componentDidCatch(err, info) {console.warn('ErrorBoundary', err, info);}
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <SafeAreaView style={[styles.container, { padding: 24 }]}>
        <Text style={styles.brand}>Something went wrong</Text>
        <Text style={styles.sub}>{String(this.state.err)}</Text>
        <TouchableOpacity style={[styles.cta, { marginTop: 16 }]} onPress={() => this.setState({ hasError: false, err: null })}>
          <View style={[styles.ctaGrad, { backgroundColor: '#111c2b', borderColor: palette.border, borderWidth: 1 }]}>
            <Text style={[styles.ctaText, { color: palette.text }]}>Try again</Text>
          </View>
        </TouchableOpacity>
      </SafeAreaView>);

  }
}


function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top + 12, paddingHorizontal: 22 }]}>
      <Text style={styles.brand}>ProsthetiScan</Text>
      <Text style={styles.hero}>AI-guided prosthetic fit from a photo.</Text>
      <Text style={styles.sub}>Calibrate with a household item, drag calipers across the limb, average shots, then generate a printable STL model.</Text>

      <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Capture')}>
        <LinearGradient colors={[palette.neon2, palette.neon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
          <Ionicons name="sparkles-outline" size={18} color="#001013" />
          <Text style={styles.ctaText}>Start Scan</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 10 }} />
      <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('History')}>
        <View style={[styles.ctaGrad, { backgroundColor: '#111c2b', borderColor: palette.border, borderWidth: 1 }]}>
          <Ionicons name="time-outline" size={18} color={palette.text} />
          <Text style={[styles.ctaText, { color: palette.text }]}>History</Text>
        </View>
      </TouchableOpacity>

      <View style={{ height: 10 }} />
      <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Presets')}>
        <View style={[styles.ctaGrad, { backgroundColor: '#111c2b', borderColor: palette.border, borderWidth: 1 }]}>
          <Ionicons name="options-outline" size={18} color={palette.text} />
          <Text style={[styles.ctaText, { color: palette.text }]}>Preset Editor</Text>
        </View>
      </TouchableOpacity>

      <StatusBar style="light" />
    </SafeAreaView>);

}


function CaptureScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [isReady, setIsReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [facing, setFacing] = useState('back');
  const cameraRef = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {if (!permission) requestPermission();}, [permission]);

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={[styles.container, { padding: 24 }]}>
        <Text style={styles.hero}>Camera preview is disabled on Web.</Text>
        <Text style={styles.sub}>Open in Expo Go on your phone to use the scanner.</Text>
      </SafeAreaView>);

  }

  if (!permission) return <SafeAreaView style={styles.center}><ActivityIndicator color={palette.neon} /></SafeAreaView>;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: palette.text, marginBottom: 8 }}>Camera permission is required</Text>
        <TouchableOpacity style={styles.cta} onPress={requestPermission}>
          <View style={[styles.ctaGrad, { backgroundColor: '#111c2b', borderColor: palette.border, borderWidth: 1 }]}>
            <Text style={[styles.ctaText, { color: palette.text }]}>Grant Permission</Text>
          </View>
        </TouchableOpacity>
      </SafeAreaView>);

  }

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, skipProcessing: true });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate('Review', { uri: photo.uri, width: photo.width || 0, height: photo.height || 0 });
    } catch (e) {
      Alert.alert('Error', 'Failed to take photo: ' + e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.topTitle}>Scanner</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <NeonChip onPress={() => setFacing((f) => f === 'back' ? 'front' : 'back')}>Flip</NeonChip>
          <NeonChip onPress={() => setTorch((t) => !t)}>{torch ? 'Torch On' : 'Torch Off'}</NeonChip>
        </View>
      </View>

      <View style={styles.previewWrap}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          enableTorch={torch}
          onCameraReady={() => { if (mountedRef.current) setIsReady(true); }} />

        <ScannerOverlay hint="Keep calibrator flat and fully visible" />
      </View>

      <View style={styles.bottomBar}>
        <Text style={styles.tip}>Tip: perpendicular camera, good light, coin flat.</Text>
        <Shutter onPress={takePhoto} disabled={!isReady} />
      </View>
    </SafeAreaView>);

}


function ReviewScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { uri, width: initialW = 0, height: initialH = 0 } = route.params || {};

  const [imageSize, setImageSize] = useState(() => ({
    w: initialW || 0,
    h: initialH || 0
  }));
  const { w: originalW, h: originalH } = imageSize;

  const [mode, setMode] = useState('cal');
  const [lockHorizontal, setLockHorizontal] = useState(true);
  const [lockMode, setLockMode] = useState('horizontal');
  const [calIndex, setCalIndex] = useState(0);

  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [drawRect, setDrawRect] = useState({ left: 0, top: 0, w: 0, h: 0 });

  useEffect(() => {
    if (!uri) return;
    if (originalW > 0 && originalH > 0) return;
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (cancelled || !w || !h) return;
        setImageSize((prev) => prev.w === w && prev.h === h ? prev : { w, h });
      },
      () => {
        if (cancelled) return;
        if (initialW > 0 && initialH > 0) {
          setImageSize((prev) => prev.w === initialW && prev.h === initialH ? prev : { w: initialW, h: initialH });
        }
      }
    );
    return () => {cancelled = true;};
  }, [uri, originalW, originalH, initialW, initialH]);

  const centerInit = (cx, cy, span = 200) => [
  { x: cx - span / 2, y: cy },
  { x: cx + span / 2, y: cy }];


  const [calPts, setCalPts] = useState(centerInit(180, 180, 160));
  const [limbPts, setLimbPts] = useState(centerInit(220, 420, 240));

  const [computing, setComputing] = useState(false);
  const [shots, setShots] = useState([]);
  const canAddMore = shots.length < 3;


  useEffect(() => {
    if (!container.w || !container.h || !originalW || !originalH) return;
    const imgAR = originalW / originalH;
    const boxAR = container.w / container.h;
    if (imgAR > boxAR) {
      const w = container.w;
      const h = w / imgAR;
      setDrawRect({ left: 0, top: (container.h - h) / 2, w, h });
    } else {
      const h = container.h;
      const w = h * imgAR;
      setDrawRect({ left: (container.w - w) / 2, top: 0, w, h });
    }
  }, [container, originalW, originalH]);


  useEffect(() => {
    if (!drawRect.w || !drawRect.h) return;
    setCalPts(centerInit(drawRect.left + drawRect.w * 0.25, drawRect.top + drawRect.h * 0.25, 160));
    setLimbPts(centerInit(drawRect.left + drawRect.w * 0.30, drawRect.top + drawRect.h * 0.55, 240));
  }, [drawRect.w, drawRect.h]);

  const constrainToImage = useCallback((pt) => ({
    x: clamp(pt.x, drawRect.left, drawRect.left + drawRect.w),
    y: clamp(pt.y, drawRect.top, drawRect.top + drawRect.h)
  }), [drawRect.left, drawRect.top, drawRect.w, drawRect.h]);

  const calPtsRef = useRef(calPts);
  const limbPtsRef = useRef(limbPts);
  useEffect(() => {calPtsRef.current = calPts;}, [calPts]);
  useEffect(() => {limbPtsRef.current = limbPts;}, [limbPts]);

  const safeUpdateCalPts = useCallback((producer) => {
    setCalPts((prev) => {
      try {
        const next = producer(prev);
        return Array.isArray(next) ? next : prev;
      } catch (err) {
        console.error('[Calipers] Failed to update calibrator points', err);
        return prev;
      }
    });
  }, []);

  const safeUpdateLimbPts = useCallback((producer) => {
    setLimbPts((prev) => {
      try {
        const next = producer(prev);
        return Array.isArray(next) ? next : prev;
      } catch (err) {
        console.error('[Calipers] Failed to update limb points', err);
        return prev;
      }
    });
  }, []);

  const rectBounds = useMemo(() => ({
    left: drawRect.left,
    top: drawRect.top,
    right: drawRect.left + drawRect.w,
    bottom: drawRect.top + drawRect.h
  }), [drawRect.left, drawRect.top, drawRect.w, drawRect.h]);

  const makeHandlePan = useCallback((which, idx) => {
    const startRef = { current: { x: 0, y: 0 } };
    const lockYRef = { current: 0 };
    const pointsRef = which === 'cal' ? calPtsRef : limbPtsRef;
    const updater = which === 'cal' ? safeUpdateCalPts : safeUpdateLimbPts;

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const pts = pointsRef.current;
        if (!pts || pts.length < 2) return;
        startRef.current = { x: pts[idx].x, y: pts[idx].y };
        lockYRef.current = pts[idx].y;
      },
      onPanResponderMove: (_evt, gesture) => {
        const pts = pointsRef.current;
        if (!pts || pts.length < 2) return;
        if (!drawRect.w || !drawRect.h) return;

        const base = {
          x: startRef.current.x + (gesture?.dx ?? 0),
          y: startRef.current.y + (gesture?.dy ?? 0)
        };
        let clamped = constrainToImage(base);
        if (lockHorizontal) {
          const lockedY = clamp(lockYRef.current, rectBounds.top, rectBounds.bottom);
          clamped = { x: clamped.x, y: lockedY };
        }

        updater((prev) => {
          if (!prev || prev.length < 2) return prev;
          const next = [{ ...prev[0] }, { ...prev[1] }];
          const otherIdx = idx === 0 ? 1 : 0;
          next[idx] = clamped;
          if (lockHorizontal) {
            const lockedY = clamped.y;
            next[otherIdx] = { ...next[otherIdx], y: lockedY };
          }
          return next;
        });
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {}
    });
  }, [constrainToImage, drawRect.h, drawRect.w, lockHorizontal, rectBounds, safeUpdateCalPts, safeUpdateLimbPts]);

  const calPan0 = useMemo(() => makeHandlePan('cal', 0), [makeHandlePan]);
  const calPan1 = useMemo(() => makeHandlePan('cal', 1), [makeHandlePan]);
  const limbPan0 = useMemo(() => makeHandlePan('limb', 0), [makeHandlePan]);
  const limbPan1 = useMemo(() => makeHandlePan('limb', 1), [makeHandlePan]);

  const makeCenterPan = useCallback((which) => {
    const pointsRef = which === 'cal' ? calPtsRef : limbPtsRef;
    const updater = which === 'cal' ? safeUpdateCalPts : safeUpdateLimbPts;
    const state = {
      startPts: null,
      startCenter: null,
      startVec: null,
      startHalf: 0,
      startDist: 0
    };
    const minSpan = 40;
    const maxSpan = 1200;

    const unitVec = (a, b) => {
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    };
    const touchesDist = (evt) => {
      const touches = evt?.nativeEvent?.touches || [];
      if (touches.length < 2) return 0;
      const [t0, t1] = touches;
      return Math.hypot((t0.pageX ?? 0) - (t1.pageX ?? 0), (t0.pageY ?? 0) - (t1.pageY ?? 0));
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const pts = pointsRef.current;
        if (!pts || pts.length < 2) return;
        state.startPts = [{ ...pts[0] }, { ...pts[1] }];
        state.startCenter = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const span = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        state.startHalf = Math.max(minSpan / 2, span / 2);
        const baseVec = unitVec(pts[0], pts[1]);
        state.startVec = lockHorizontal ? { x: baseVec.x, y: 0 } : baseVec;
        state.startDist = touchesDist(evt);
      },
      onPanResponderMove: (evt, gesture) => {
        if (!drawRect.w || !drawRect.h) return;
        const pts = pointsRef.current;
        if (!pts || pts.length < 2) return;

        const touchDistance = touchesDist(evt);
        const isPinch = evt?.nativeEvent?.touches?.length >= 2 && state.startDist > 0;

        if (isPinch) {
          const rawScale = touchDistance / state.startDist;
          const safeScale = clamp(Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1, 0.4, 4);
          let half = state.startHalf * safeScale;
          half = clamp(half, minSpan / 2, maxSpan / 2);
          const dir = state.startVec || { x: 1, y: 0 };
          const center = state.startCenter || { x: (rectBounds.left + rectBounds.right) / 2, y: (rectBounds.top + rectBounds.bottom) / 2 };
          let p0 = { x: center.x - dir.x * half, y: center.y - dir.y * half };
          let p1 = { x: center.x + dir.x * half, y: center.y + dir.y * half };
          if (lockHorizontal) {
            const lockedY = clamp(center.y, rectBounds.top, rectBounds.bottom);
            p0.y = lockedY;
            p1.y = lockedY;
          }
          p0 = constrainToImage(p0);
          p1 = constrainToImage(p1);
          updater(() => [p0, p1]);
          return;
        }

        if (!state.startPts) return;
        const dx = gesture?.dx ?? 0;
        const dyRaw = gesture?.dy ?? 0;

        const [start0, start1] = state.startPts;
        const minDx = Math.max(rectBounds.left - start0.x, rectBounds.left - start1.x);
        const maxDx = Math.min(rectBounds.right - start0.x, rectBounds.right - start1.x);
        const moveX = clamp(dx, minDx, maxDx);

        const moveY = lockHorizontal ? 0 : (() => {
          const minDy = Math.max(rectBounds.top - start0.y, rectBounds.top - start1.y);
          const maxDy = Math.min(rectBounds.bottom - start0.y, rectBounds.bottom - start1.y);
          return clamp(dyRaw, minDy, maxDy);
        })();

        let p0 = { x: start0.x + moveX, y: start0.y + moveY };
        let p1 = { x: start1.x + moveX, y: start1.y + moveY };
        if (lockHorizontal) {
          const lockedY = clamp(p0.y, rectBounds.top, rectBounds.bottom);
          p0.y = lockedY;
          p1.y = lockedY;
        }
        p0 = constrainToImage(p0);
        p1 = constrainToImage(p1);
        updater(() => [p0, p1]);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {}
    });
  }, [constrainToImage, drawRect.h, drawRect.w, lockHorizontal, rectBounds, safeUpdateCalPts, safeUpdateLimbPts]);

  const calCenterPan = useMemo(() => makeCenterPan('cal'), [makeCenterPan]);
  const limbCenterPan = useMemo(() => makeCenterPan('limb'), [makeCenterPan]);
  const displayToImage = (p) => {
    const nx = (p.x - drawRect.left) / (drawRect.w || 1);
    const ny = (p.y - drawRect.top) / (drawRect.h || 1);
    return { x: nx * originalW, y: ny * originalH };
  };


  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDeg = (a, b) => Math.abs(rad2deg(Math.atan2(b.y - a.y, b.x - a.x)));

  const recommendSize = (mm) => mm < 60 ? 'XS/S' : mm < 80 ? 'M' : mm < 95 ? 'L' : 'XL';

  const computeConfidence = (calPx, limbPx, ang) => {
    const calScore = clamp((calPx - 40) / 120, 0, 1);
    const limbScore = clamp((limbPx - 40) / 120, 0, 1);
    const angleScore = clamp(1 - Math.min(ang, Math.abs(180 - ang)) / 45, 0, 1);
    return Math.round((calScore * 0.45 + limbScore * 0.35 + angleScore * 0.2) * 100);
  };

  const computeLocalOnce = () => {
    const c1 = displayToImage(calPts[0]);
    const c2 = displayToImage(calPts[1]);
    const l1 = displayToImage(limbPts[0]);
    const l2 = displayToImage(limbPts[1]);

    const calPx = d(c1, c2);
    const limbPx = d(l1, l2);
    const calMM = CALIBRATORS[calIndex].mm;

    const pxPerMM = calPx / calMM;
    const widthMM = limbPx / pxPerMM;
    const ang = angleDeg(l1, l2);
    const conf = computeConfidence(calPx, limbPx, ang);

    return { widthMM, calPx, limbPx, angleDeg: ang, confidence: conf };
  };

  useEffect(() => {
    if (!lockHorizontal) return;
    if (!drawRect.w || !drawRect.h) return;
    const alignY = (pts) => {
      if (!pts || pts.length < 2) return pts;
      const averageY = clamp((pts[0].y + pts[1].y) / 2, rectBounds.top, rectBounds.bottom);
      return [{ x: pts[0].x, y: averageY }, { x: pts[1].x, y: averageY }];
    };
    setCalPts((prev) => alignY(prev) || prev);
    setLimbPts((prev) => alignY(prev) || prev);
  }, [drawRect.h, drawRect.w, lockHorizontal, rectBounds.bottom, rectBounds.top]);

  const centerOf = (pts) => ({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });


  const computeAndAddShot = async () => {
    if (!drawRect.w || !drawRect.h) {Alert.alert('Image not ready', 'Please wait for the image to layout.');return;}
    if (!calPts || calPts.length < 2) {Alert.alert('Calibrate first', 'Drag the BLUE handles across the calibrator.');return;}
    if (!limbPts || limbPts.length < 2) {Alert.alert('Mark width', 'Drag the GREEN handles across the limb.');return;}

    setComputing(true);
    try {
      const { widthMM, calPx, limbPx, angleDeg: ang, confidence } = computeLocalOnce();
      if (calPx < 40) {Alert.alert('Calibrator too small', 'Retake so the item spans at least ~40 pixels.');setComputing(false);return;}
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShots((prev) => [...prev, { widthMM, calPx, limbPx, angleDeg: ang, confidence }]);


      const c = centerOf(limbPts);
      setLimbPts(centerInit(c.x, c.y, d(limbPts[0], limbPts[1])));
      setMode('limb');
    } catch (e) {
      Alert.alert('Error', 'Compute failed: ' + e.message);
    } finally {
      setComputing(false);
    }
  };

  const finalizeAverage = async () => {
    if (shots.length === 0) {Alert.alert('Add a shot', 'Add at least one measurement.');return;}
    const widths = shots.map((s) => s.widthMM);
    const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
    const spread = Math.max(...widths) - Math.min(...widths);
    const scaleOK = Math.max(...shots.map((s) => s.calPx)) >= 60;
    const result = {
      width_mm: avg,
      spread_mm: spread,
      shots,
      recommendation: recommendSize(avg),
      scale_ok: scaleOK,
      calibrator_key: CALIBRATORS[calIndex].key
    };
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.navigate('Results', { result, photoUri: uri });
  };

  const liveConf = useMemo(() => {
    if (drawRect.w && calPts.length === 2 && limbPts.length === 2) {
      return computeLocalOnce();
    }
    return null;
  }, [calPts, limbPts, drawRect.w, drawRect.h, calIndex]);

  const reset = () => {
    if (!drawRect.w || !drawRect.h) return;
    setCalPts(centerInit(drawRect.left + drawRect.w * 0.25, drawRect.top + drawRect.h * 0.25, 160));
    setLimbPts(centerInit(drawRect.left + drawRect.w * 0.30, drawRect.top + drawRect.h * 0.55, 240));
  };

  const Handle = ({ p, color, responder }) =>
  <View
    {...responder.panHandlers}
    onStartShouldSetResponder={() => true}
    style={[styles.handle, { left: p.x - 18, top: p.y - 18, backgroundColor: color, shadowColor: color }]} />;



  const CenterGrip = ({ at, responder, tone }) =>
  <View
    {...responder.panHandlers}
    style={[
    styles.centerGrip,
    { left: at.x - 32, top: at.y - 18, borderColor: tone, shadowColor: tone }]
    }>

      <Ionicons name="move-outline" size={14} color={tone} />
    </View>;


  const LineBetween = ({ a, b, color }) =>
  <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth="3" strokeLinecap="round" />
    </Svg>;


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.topTitle}>Adjust Calipers</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <NeonChip active={mode === 'cal'} onPress={() => setMode('cal')}>Calibrate</NeonChip>
          <NeonChip active={mode === 'limb'} onPress={() => setMode('limb')}>Limb</NeonChip>
          <NeonChip onPress={reset}>Reset</NeonChip>
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: 12, marginBottom: 6 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CALIBRATORS.map((c, i) =>
          <NeonChip key={c.key} active={i === calIndex} onPress={() => setCalIndex(i)}>
              {c.label}
            </NeonChip>
          )}
        </ScrollView>
      </View>

      {}
      <View
        style={{ flex: 1, backgroundColor: '#000' }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setContainer({ w: width, h: height });
        }}>

        <Image source={{ uri }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />

        {}
        <View style={styles.overlay} pointerEvents="box-none">
          {mode === 'cal' ? (
            <>
              <Caliper points={limbPts} onChange={setLimbPts} bounds={drawRect} colorMain={palette.neon} axisLock={lockMode} enableTap={false} />
              <Caliper points={calPts} onChange={setCalPts} bounds={drawRect} colorMain={palette.neon2} axisLock={lockMode} enableTap={true} />
            </>
          ) : (
            <>
              <Caliper points={calPts} onChange={setCalPts} bounds={drawRect} colorMain={palette.neon2} axisLock={lockMode} enableTap={false} />
              <Caliper points={limbPts} onChange={setLimbPts} bounds={drawRect} colorMain={palette.neon} axisLock={lockMode} enableTap={true} />
            </>
          )}
        </View>

        <ScannerOverlay beam={false} hint={mode === 'cal' ? 'Drag BLUE handles across calibrator' : 'Drag GREEN handles across limb'} />
      </View>

      <View style={[styles.bottomBar, { gap: 12 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <TouchableOpacity onPress={() => { setLockMode('free'); setLockHorizontal(false); }}>
            <LinearGradient colors={lockMode === 'free' ? [palette.neon2, palette.neon] : ['#111c2b', '#111c2b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.chip, { paddingHorizontal: 14, paddingVertical: 10 }]}> 
              <Text style={[styles.chipText, { color: lockMode === 'free' ? '#001013' : palette.text }]}>Free</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setLockMode('horizontal'); setLockHorizontal(true); }}>
            <LinearGradient colors={lockMode === 'horizontal' ? [palette.neon2, palette.neon] : ['#111c2b', '#111c2b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.chip, { paddingHorizontal: 14, paddingVertical: 10 }]}> 
              <Text style={[styles.chipText, { color: lockMode === 'horizontal' ? '#001013' : palette.text }]}>Horizontal</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setLockMode('vertical'); setLockHorizontal(false); }}>
            <LinearGradient colors={lockMode === 'vertical' ? [palette.neon2, palette.neon] : ['#111c2b', '#111c2b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.chip, { paddingHorizontal: 14, paddingVertical: 10 }]}> 
              <Text style={[styles.chipText, { color: lockMode === 'vertical' ? '#001013' : palette.text }]}>Vertical</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>

        {!!liveConf &&
        <Text style={[styles.sub, { marginBottom: 0 }]}>
            Live width {liveConf.widthMM.toFixed(1)} mm Â· confidence {liveConf.confidence}%
          </Text>
        }

        <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
          <TouchableOpacity style={[styles.cta, { flex: 1 }]} onPress={computeAndAddShot} disabled={computing || !canAddMore}>
            <LinearGradient colors={[palette.neon2, palette.neon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.ctaGrad, computing && { opacity: 0.6 }]}>
              {computing ? <ActivityIndicator color="#001013" /> : <Ionicons name="add-circle-outline" size={18} color="#001013" />}
              <Text style={styles.ctaText}>{computing ? 'Measuringâ€¦' : 'Add shot'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.cta, { flex: 1 }]} onPress={finalizeAverage}>
            <View style={[styles.ctaGrad, { backgroundColor: '#111c2b', borderColor: palette.border, borderWidth: 1 }]}>
              <Ionicons name="checkmark-done-outline" size={18} color={palette.text} />
              <Text style={[styles.ctaText, { color: palette.text }]}>Average and Continue</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sub, { marginTop: 2 }]}>{shots.length} shot(s) added</Text>
      </View>
    </SafeAreaView>);

}


function ResultsScreen({ route, navigation }) {
  const { result, photoUri } = route.params || {};
  const [saving, setSaving] = useState(false);

  async function saveToHistory(entry) {
    try {
      const prev = await AsyncStorage.getItem(keyHistory);
      const arr = prev ? JSON.parse(prev) : [];
      arr.unshift({ ts: Date.now(), photoUri, ...entry });
      await AsyncStorage.setItem(keyHistory, JSON.stringify(arr.slice(0, 100)));
    } catch {}
  }
  useEffect(() => {if (result) saveToHistory(result);}, [result]);

  const saveJson = async () => {
    try {
      setSaving(true);
      const filename = `${FileSystem.documentDirectory}prosthetiscan_result_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(filename, JSON.stringify(result, null, 2), { encoding: 'utf8' });
      Alert.alert('Saved', 'JSON saved to: ' + filename);
    } catch (e) {
      Alert.alert('Error', 'Save failed: ' + e.message);
    } finally {setSaving(false);}
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg, paddingHorizontal: 22 }]}>
      <Text style={styles.brand}>Result</Text>
      <View style={styles.resultCard}>
        <View style={{ gap: 6 }}>
          <Text style={styles.resultLabel}>Average width</Text>
          <Text style={styles.resultValue}>{typeof result?.width_mm === 'number' ? result.width_mm.toFixed(1) : 'â€”'} mm</Text>
          <Text style={styles.sub}>Spread: {typeof result?.spread_mm === 'number' ? result.spread_mm.toFixed(1) : 'â€”'} mm</Text>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.resultLabel}>Recommendation</Text>
          <Text style={styles.resultText}>{result?.recommendation || 'â€”'}</Text>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={styles.resultLabel}>Scale</Text>
          <Text style={styles.resultText}>{result?.scale_ok ? 'ok' : 'unknown'}</Text>
        </View>
      </View>

      <TouchableOpacity style={[styles.cta, { marginTop: 12 }]} onPress={() => navigation.navigate('Model', { result })}>
        <LinearGradient colors={[palette.neon2, palette.neon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
          <Ionicons name="cube-outline" size={18} color="#001013" />
          <Text style={styles.ctaText}>Create 3D Model (STL)</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.cta, { marginTop: 10 }]} onPress={saveJson} disabled={saving}>
        <View style={[styles.ctaGrad, { backgroundColor: '#111c2b', borderColor: palette.border, borderWidth: 1 }]}>
          {saving ? <ActivityIndicator color={palette.text} /> : <Ionicons name="download-outline" size={18} color={palette.text} />}
          <Text style={[styles.ctaText, { color: palette.text }]}>{saving ? 'Savingâ€¦' : 'Export JSON'}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.cta, { marginTop: 10 }]} onPress={() => navigation.popToTop()}>
        <View style={[styles.ctaGrad, { backgroundColor: '#111c2b', borderColor: palette.border, borderWidth: 1 }]}>
          <Ionicons name="home-outline" size={18} color={palette.text} />
          <Text style={[styles.ctaText, { color: palette.text }]}>Back to Home</Text>
        </View>
      </TouchableOpacity>
    </SafeAreaView>);

}


function ModelScreen({ route, navigation }) {
  const { result } = route.params || {};
  const widthMM = typeof result?.width_mm === 'number' ? result.width_mm : null;

  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  useFocusEffect(useCallback(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(keyPresets);
      if (raw) setPresets(JSON.parse(raw));
    })();
  }, []));

  const [presetIdx, setPresetIdx] = useState(1);
  const preset = presets[presetIdx] || presets[0];

  const [lastSTLPath, setLastSTLPath] = useState(null);

  const generateSTL = async () => {
    if (!widthMM) {Alert.alert('Missing measurement', 'Compute a width before generating a model.');return null;}
    try {
      const innerDiameter = Math.max(20, widthMM + 2);
      const rinBottom = innerDiameter / 2;
      const rinTop = rinBottom * preset.flare;
      const thickness = preset.thicknessMM;
      const routBottom = rinBottom + thickness;
      const routTop = rinTop + thickness;
      const name = `${preset.key}_${Math.round(innerDiameter)}mm`;
      const stl = cylindricalRingSTL(name, rinBottom, routBottom, rinTop, routTop, preset.heightMM, preset.segments);
      const file = `${FileSystem.documentDirectory}${name}.stl`;
      await FileSystem.writeAsStringAsync(file, stl, { encoding: 'utf8' });
      setLastSTLPath(file);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return { file, name, stl };
    } catch (e) {
      Alert.alert('Error', 'Failed to generate STL: ' + e.message);
      return null;
    }
  };

  const generateAndShare = async () => {
    const out = await generateSTL();
    if (!out) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(out.file, { dialogTitle: 'Share STL for printing', mimeType: 'model/stl', UTI: 'public.data' });
    } else {
      Alert.alert('Saved', `File saved to: ${out.file}`);
    }
  };

  const generateZipBundle = async () => {
    const out = await generateSTL();
    if (!out) return;
    const { name, stl } = out;
    const zip = new JSZip();
    zip.file(`${name}.stl`, stl);
    const readme = `ProsthetiScan export

Preset: ${preset.label}
Height: ${preset.heightMM} mm
Wall: ${preset.thicknessMM} mm
Top flare: ${(preset.flare - 1) * 100} %
Segments: ${preset.segments}

Units: millimeters.
Suggested print: PETG, 0.2â€“0.28 mm layers, 3 perimeters, infill 0%, brim for adhesion.
This STL is a simplified shell for test fitting. Not a medical device.`;
    zip.file('README.txt', readme);

    const base64 = await zip.generateAsync({ type: 'base64' });
    const zipPath = `${FileSystem.documentDirectory}${name}.zip`;
    await FileSystem.writeAsStringAsync(zipPath, base64, { encoding: 'base64' });
    await Sharing.shareAsync(zipPath, { dialogTitle: 'Share bundle (.zip)', mimeType: 'application/zip', UTI: 'public.zip-archive' });
  };

  return (
    <SafeAreaView style={[styles.container, { alignItems: 'stretch', paddingHorizontal: 16 }]}>
      <Text style={styles.brand}>3D Model</Text>

      <View style={[styles.resultCard, { marginBottom: 12 }]}>
        <Text style={styles.resultLabel}>Measured width</Text>
        <Text style={styles.resultValue}>{widthMM ? `${widthMM.toFixed(1)} mm` : 'â€”'}</Text>
        <Text style={[styles.sub, { marginTop: 8 }]}>
          Select the limb target and generate a tapered shell. Units are mm.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
        {presets.map((p, i) =>
        <NeonChip key={p.key} active={i === presetIdx} onPress={() => setPresetIdx(i)}>{p.label}</NeonChip>
        )}
      </ScrollView>

      <View style={[styles.resultCard, { marginTop: 8 }]}>
        <Text style={styles.resultLabel}>Preset parameters</Text>
        <Text style={styles.resultText}>Height: {preset.heightMM} mm</Text>
        <Text style={styles.resultText}>Wall: {preset.thicknessMM} mm</Text>
        <Text style={styles.resultText}>Top flare: {Math.round((preset.flare - 1) * 100)}%</Text>
        <Text style={styles.resultText}>Segments: {preset.segments}</Text>
      </View>

      <View style={{ height: 8 }} />

      <TouchableOpacity style={styles.cta} onPress={generateAndShare}>
        <LinearGradient colors={[palette.neon2, palette.neon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
          <Ionicons name="cube-outline" size={18} color="#001013" />
          <Text style={styles.ctaText}>Generate STL and Share</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 8 }} />

      <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Preview3D', { preset, result, lastSTLPath })}>
        <View style={[styles.ctaGrad, { backgroundColor: '#111c2b', borderColor: palette.border, borderWidth: 1 }]}>
          <Ionicons name="eye-outline" size={18} color={palette.text} />
          <Text style={[styles.ctaText, { color: palette.text }]}>Preview 3D</Text>
        </View>
      </TouchableOpacity>

      <View style={{ height: 8 }} />

      <TouchableOpacity style={styles.cta} onPress={generateZipBundle}>
        <View style={[styles.ctaGrad, { backgroundColor: '#111c2b', borderColor: palette.border, borderWidth: 1 }]}>
          <Ionicons name="archive-outline" size={18} color={palette.text} />
          <Text style={[styles.ctaText, { color: palette.text }]}>Export Bundle (.zip)</Text>
        </View>
      </TouchableOpacity>
    </SafeAreaView>);

}


function Preview3DScreen({ route }) {
  const { preset, result, lastSTLPath } = route.params || {};
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);
  const [GLView, setGLView] = useState(null);
  const [THREE, setTHREE] = useState(null);
  const [STLLoader, setSTLLoader] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { GLView: GL } = await import('expo-gl');
        const three = await import('three');
        const { STLLoader: Loader } = await import('three-stdlib');
        if (!mounted) return;
        setGLView(() => GL);
        setTHREE(three);
        setSTLLoader(() => Loader);
        setReady(true);
      } catch (e) {
        setErr(String(e));
      }
    })();
    return () => {mounted = false;};
  }, []);

  const onContextCreate = async (gl) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, -200, 140);
    camera.lookAt(0, 0, 50);

    const renderer = new THREE.WebGLRenderer({ canvas: gl.canvas, context: gl, antialias: true });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x0b0f14);
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = true;
    if (renderer.outputColorSpace && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (renderer.outputEncoding && THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    const light = new THREE.DirectionalLight(0xffffff, 0.9);
    light.position.set(100, -100, 200);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x666666));

    


    let stlText = null;
    if (lastSTLPath) {
      stlText = await FileSystem.readAsStringAsync(lastSTLPath, { encoding: 'utf8' });
    } else {
      const widthMM = result?.width_mm || 80;
      const innerDiameter = Math.max(20, widthMM + 2);
      const rinBottom = innerDiameter / 2;
      const rinTop = rinBottom * (preset?.flare || 1.05);
      const t = preset?.thicknessMM || 3;
      const stl = cylindricalRingSTL('preview', rinBottom, rinBottom + t, rinTop, rinTop + t, preset?.heightMM || 100, preset?.segments || 96);
      stlText = stl;
    }
    const loader = new STLLoader();
    const __encode = (s) => { try { return new TextEncoder().encode(s).buffer; } catch (_) { const str = unescape(encodeURIComponent(s)); const arr = new Uint8Array(str.length); for (let i=0;i<str.length;i++) arr[i] = str.charCodeAt(i); return arr.buffer; } }; const arrayBuffer = __encode(stlText);
    const geom = loader.parse(arrayBuffer);
    const mesh = new THREE.Mesh(geom, new THREE.MeshPhongMaterial({ color: 0x7fd, shininess: 30 }));
    scene.add(mesh);

    let rotate = 0;
    const render = () => {
      rotate += 0.003;
      mesh.rotation.z = rotate;
      renderer.render(scene, camera);
      gl.endFrameEXP();
      anim = requestAnimationFrame(render);
    };
    let anim = requestAnimationFrame(render);


    let lastX = null,lastY = null;
    const onTouchStart = (e) => {lastX = e.nativeEvent.locationX;lastY = e.nativeEvent.locationY;};
    const onTouchMove = (e) => {
      if (lastX == null) return;
      const dx = (e.nativeEvent.locationX - lastX) * 0.01;
      const dy = (e.nativeEvent.locationY - lastY) * 0.01;
      mesh.rotation.y += dx;
      mesh.rotation.x += dy;
      lastX = e.nativeEvent.locationX;lastY = e.nativeEvent.locationY;
    };
    gl && gl.canvas && gl.canvas.addEventListener('touchstart', onTouchStart, false);
    gl && gl.canvas && gl.canvas.addEventListener('touchmove', onTouchMove, false);

    return () => {
      cancelAnimationFrame(anim);
    };
  };

  if (err) {
    return (
      <SafeAreaView style={[styles.container, { padding: 24 }]}>
        <Text style={styles.brand}>Preview 3D</Text>
        <Text style={styles.sub}>{err}</Text>
      </SafeAreaView>);

  }
  if (!ready || !GLView) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={palette.neon} />
        <Text style={[styles.sub, { marginTop: 10 }]}>Loading 3D engineâ€¦</Text>
      </SafeAreaView>);

  }
  const Comp = GLView;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <Comp style={{ flex: 1 }} onContextCreate={onContextCreate} />
    </SafeAreaView>);

}


function PresetEditorScreen() {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [idx, setIdx] = useState(1);

  useEffect(() => {(async () => {
      const raw = await AsyncStorage.getItem(keyPresets);
      if (raw) setPresets(JSON.parse(raw));
    })();}, []);

  const p = presets[idx];

  const setField = (k, v) => {
    const next = presets.slice();
    next[idx] = { ...next[idx], [k]: v };
    setPresets(next);
  };

  const save = async () => {
    await AsyncStorage.setItem(keyPresets, JSON.stringify(presets));
    Alert.alert('Saved', 'Presets updated.');
  };

  const Num = ({ label, value, step, onChange }) =>
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 }}>
      <Text style={styles.resultText}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity onPress={() => onChange(clamp(Number((value - step).toFixed(2)), 0, 999))}>
          <View style={[styles.chip, { backgroundColor: '#111c2b', borderColor: palette.border, borderWidth: 1 }]}><Text style={styles.chipText}>-</Text></View>
        </TouchableOpacity>
        <Text style={styles.resultText}>{value}</Text>
        <TouchableOpacity onPress={() => onChange(clamp(Number((value + step).toFixed(2)), 0, 999))}>
          <View style={[styles.chip, { backgroundColor: '#111c2b', borderColor: palette.border, borderWidth: 1 }]}><Text style={styles.chipText}>+</Text></View>
        </TouchableOpacity>
      </View>
    </View>;


  return (
    <SafeAreaView style={[styles.container, { alignItems: 'stretch', paddingHorizontal: 16 }]}>
      <Text style={styles.brand}>Preset Editor</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
        {presets.map((pp, i) =>
        <NeonChip key={pp.key} active={i === idx} onPress={() => setIdx(i)}>{pp.label}</NeonChip>
        )}
      </ScrollView>

      <View style={[styles.resultCard, { marginTop: 8 }]}>
        <Num label="Height (mm)" value={p.heightMM} step={5} onChange={(v) => setField('heightMM', v)} />
        <Num label="Wall (mm)" value={p.thicknessMM} step={0.5} onChange={(v) => setField('thicknessMM', v)} />
        <Num label="Flare (Ã—)" value={p.flare} step={0.01} onChange={(v) => setField('flare', v)} />
        <Num label="Segments" value={p.segments} step={8} onChange={(v) => setField('segments', Math.round(v))} />
      </View>

      <TouchableOpacity style={[styles.cta, { marginTop: 12 }]} onPress={save}>
        <LinearGradient colors={[palette.neon2, palette.neon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
          <Ionicons name="save-outline" size={18} color="#001013" />
          <Text style={styles.ctaText}>Save Presets</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>);

}


function HistoryScreen() {
  const [items, setItems] = useState([]);
  useFocusEffect(useCallback(() => {(async () => {
      const data = await AsyncStorage.getItem(keyHistory);
      setItems(data ? JSON.parse(data) : []);
    })();}, []));
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg, paddingHorizontal: 16, alignItems: 'stretch' }]}>
      <Text style={styles.brand}>History</Text>
      {items.length === 0 ? <Text style={[styles.sub, { textAlign: 'center' }]}>No saved measurements yet.</Text> : null}
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {items.map((it, i) =>
        <View key={i} style={styles.historyCard}>
            {!!it.photoUri && <Image source={{ uri: it.photoUri }} style={{ width: '100%', height: 140, borderRadius: 10, marginBottom: 8 }} />}
            <Text style={styles.historyWhen}>{new Date(it.ts).toLocaleString()}</Text>
            <Text style={styles.historyLine}>Width: {it.width_mm?.toFixed?.(1)} mm {typeof it.spread_mm === 'number' ? `(spread ${it.spread_mm.toFixed(1)} mm)` : ''}</Text>
            <Text style={styles.historyLine}>Recommendation: {it.recommendation}</Text>
            <Text style={styles.historyLine}>Calibrator: {it.calibrator_key}</Text>
            <Text style={styles.historyLine}>Scale ok: {String(it.scale_ok)}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>);

}


function Onboarding({ onDone }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={[styles.container, { width: Dimensions.get('window').width, padding: 24 }]}>
          <Text style={styles.brand}>Welcome</Text>
          <Text style={styles.hero}>Pick a calibrator, drag BLUE dots across it, drag GREEN dots across the limb. Use the center grip to move the whole line. Pinch the center grip to resize.</Text>
        </View>
        <View style={[styles.container, { width: Dimensions.get('window').width, padding: 24 }]}>
          <Text style={styles.brand}>Tips</Text>
          <Text style={styles.sub}>Keep the item and limb in the same plane, camera perpendicular, good lighting. Use Lock Horizontal for cleaner widths.</Text>
        </View>
        <View style={[styles.container, { width: Dimensions.get('window').width, padding: 24 }]}>
          <Text style={styles.brand}>Ready</Text>
          <TouchableOpacity style={styles.cta} onPress={onDone}>
            <LinearGradient colors={[palette.neon2, palette.neon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGrad}>
              <Text style={styles.ctaText}>Start</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>);

}


function Root() {
  const [showOnboard, setShowOnboard] = useState(false);
  useEffect(() => {(async () => {
      const done = await AsyncStorage.getItem(keyOnboard);
      if (!done) setShowOnboard(true);
    })();}, []);
  const finish = async () => {await AsyncStorage.setItem(keyOnboard, '1');setShowOnboard(false);};

  return (
    <>
      {showOnboard ? <Onboarding onDone={finish} /> :
      <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bg } }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Capture" component={CaptureScreen} />
            <Stack.Screen name="Review" component={ReviewScreen} />
            <Stack.Screen name="Results" component={ResultsScreen} />
            <Stack.Screen name="Model" component={ModelScreen} />
            <Stack.Screen name="Preview3D" component={Preview3DScreen} />
            <Stack.Screen name="Presets" component={PresetEditorScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      }
    </>);

}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <Root />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>);

}


const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg, padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg },
  brand: { fontSize: 26, fontWeight: '800', color: palette.text, marginBottom: 10 },
  hero: { fontSize: 18, color: palette.text, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, color: palette.sub, textAlign: 'center', marginBottom: 14 },
  cta: { width: '100%' },
  ctaGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14 },

  topBar: { paddingHorizontal: 16, paddingBottom: 10, backgroundColor: palette.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { color: palette.text, fontSize: 18, fontWeight: '700' },

  previewWrap: { flex: 1, overflow: 'hidden', borderRadius: 16, marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: palette.border },

  scanFrame: { position: 'absolute', left: 14, right: 14, top: 14, bottom: 14, borderRadius: 16 },
  scanHint: { position: 'absolute', bottom: 12, left: 14, right: 14, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, flexDirection: 'row', alignItems: 'center' },

  bottomBar: { padding: 14, backgroundColor: palette.bg, alignItems: 'center', gap: 10 },
  tip: { color: palette.sub, fontSize: 12 },

  shutter: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', shadowColor: palette.neon, shadowRadius: 10, shadowOpacity: 0.5 },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#001013' },

  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  chipText: { color: palette.sub, fontSize: 12 },


  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },

  handle: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.neon,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    zIndex: 20
  },
  centerGrip: {
    position: 'absolute',
    width: 64,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,22,34,0.75)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    zIndex: 19
  },

  resultCard: { width: '100%', backgroundColor: '#0f1622', borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: palette.border },
  resultLabel: { color: palette.sub, fontSize: 12 },
  resultValue: { color: palette.text, fontSize: 22, fontWeight: '800' },
  resultText: { color: palette.text, fontSize: 16 },

  historyCard: { backgroundColor: '#0f1622', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: palette.border },
  historyWhen: { color: palette.sub, marginBottom: 6 },
  historyLine: { color: palette.text }
});
