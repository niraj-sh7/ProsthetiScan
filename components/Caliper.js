import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line as SvgLine, Circle as SvgCircle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, useAnimatedStyle, useDerivedValue, withSpring, withTiming, withRepeat, Easing, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const AnimatedLine = Animated.createAnimatedComponent(SvgLine);
const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

function clamp(v, a, b) { 'worklet'; return Math.max(a, Math.min(b, v)); }
function dist(x1, y1, x2, y2) { 'worklet'; return Math.hypot(x2 - x1, y2 - y1); }

export default function Caliper({ points, onChange, bounds, colorMain, axisLock = 'horizontal', width, height, showLabel = true, enableTap = true }) {
  const left = bounds.left, top = bounds.top, right = bounds.left + bounds.w, bottom = bounds.top + bounds.h;
  const x1 = useSharedValue(points?.[0]?.x ?? left + bounds.w * 0.25);
  const y1 = useSharedValue(points?.[0]?.y ?? top + bounds.h * 0.5);
  const x2 = useSharedValue(points?.[1]?.x ?? left + bounds.w * 0.75);
  const y2 = useSharedValue(points?.[1]?.y ?? top + bounds.h * 0.5);
  const axisLockSV = useSharedValue(axisLock === 'horizontal' ? 1 : axisLock === 'vertical' ? 2 : 0);
  useEffect(() => { axisLockSV.value = axisLock === 'horizontal' ? 1 : axisLock === 'vertical' ? 2 : 0; }, [axisLock]);
  const centerX = useDerivedValue(() => (x1.value + x2.value) / 2);
  const centerY = useDerivedValue(() => (y1.value + y2.value) / 2);
  const len = useDerivedValue(() => Math.hypot(x2.value - x1.value, y2.value - y1.value));
  const ang = useDerivedValue(() => Math.atan2(y2.value - y1.value, x2.value - x1.value));
  const dash = useSharedValue(0);
  const snapState = useSharedValue('none');
  const active1 = useSharedValue(0);
  const active2 = useSharedValue(0);
  const activeC = useSharedValue(0);
  const draggingRef = useRef(false);
  const setDragging = (v) => { draggingRef.current = v; };

  useEffect(() => {
    if (!points || points.length < 2) return;
    if (draggingRef.current) return;
    const p0 = points[0];
    const p1 = points[1];
    if (Math.abs(x1.value - p0.x) > 0.5 || Math.abs(y1.value - p0.y) > 0.5) { x1.value = p0.x; y1.value = p0.y; }
    if (Math.abs(x2.value - p1.x) > 0.5 || Math.abs(y2.value - p1.y) > 0.5) { x2.value = p1.x; y2.value = p1.y; }
  }, [points]);

  React.useEffect(() => { dash.value = withRepeat(withTiming(100, { duration: 1200, easing: Easing.linear }), -1, false); }, []);

  function applyLockSnap(nx1, ny1, nx2, ny2) {
    'worklet';
    const deg = Math.abs((Math.atan2(ny2 - ny1, nx2 - nx1) * 180) / Math.PI);
    if (axisLockSV.value === 1) { const my = (ny1 + ny2) / 2; ny1 = my; ny2 = my; if (snapState.value !== 'h') { snapState.value = 'h'; runOnJS(Haptics.selectionAsync)(); } }
    else if (axisLockSV.value === 2) { const mx = (nx1 + nx2) / 2; nx1 = mx; nx2 = mx; if (snapState.value !== 'v') { snapState.value = 'v'; runOnJS(Haptics.selectionAsync)(); } }
    else {
      if (Math.abs(deg - 0) <= 8 || Math.abs(deg - 180) <= 8) { const my = (ny1 + ny2) / 2; ny1 = my; ny2 = my; if (snapState.value !== 'h') { snapState.value = 'h'; runOnJS(Haptics.selectionAsync)(); } }
      else if (Math.abs(deg - 90) <= 8 || Math.abs(deg - 270) <= 8) { const mx = (nx1 + nx2) / 2; nx1 = mx; nx2 = mx; if (snapState.value !== 'v') { snapState.value = 'v'; runOnJS(Haptics.selectionAsync)(); } }
      else { if (snapState.value !== 'none') snapState.value = 'none'; }
    }
    return { x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
  }

  function clampAll(a, b, c, d) { 'worklet'; return { x1: clamp(a, left, right), y1: clamp(b, top, bottom), x2: clamp(c, left, right), y2: clamp(d, top, bottom) }; }

  const pan1 = Gesture.Pan()
    .hitSlop(16)
    .minDistance(0)
    .onBegin(() => { active1.value = 1; runOnJS(setDragging)(true); })
    .onChange(e => {
    let nx1 = clamp(x1.value + e.changeX, left, right);
    let ny1 = clamp(y1.value + e.changeY, top, bottom);
    let nx2 = x2.value;
    let ny2 = y2.value;
    const r = applyLockSnap(nx1, ny1, nx2, ny2);
    x1.value = r.x1; y1.value = r.y1; x2.value = r.x2; y2.value = r.y2;
    }).onFinalize(() => {
    active1.value = 0; runOnJS(setDragging)(false);
    x1.value = withSpring(clamp(x1.value, left, right));
    y1.value = withSpring(clamp(y1.value, top, bottom));
    if (onChange) runOnJS(onChange)([{ x: x1.value, y: y1.value }, { x: x2.value, y: y2.value }]);
    });

  const pan2 = Gesture.Pan()
    .hitSlop(16)
    .minDistance(0)
    .onBegin(() => { active2.value = 1; runOnJS(setDragging)(true); })
    .onChange(e => {
    let nx1 = x1.value;
    let ny1 = y1.value;
    let nx2 = clamp(x2.value + e.changeX, left, right);
    let ny2 = clamp(y2.value + e.changeY, top, bottom);
    const r = applyLockSnap(nx1, ny1, nx2, ny2);
    x1.value = r.x1; y1.value = r.y1; x2.value = r.x2; y2.value = r.y2;
    }).onFinalize(() => {
    active2.value = 0; runOnJS(setDragging)(false);
    x2.value = withSpring(clamp(x2.value, left, right));
    y2.value = withSpring(clamp(y2.value, top, bottom));
    if (onChange) runOnJS(onChange)([{ x: x1.value, y: y1.value }, { x: x2.value, y: y2.value }]);
    });

  const panGrip = Gesture.Pan()
    .hitSlop(16)
    .minDistance(0)
    .onBegin(() => { activeC.value = 1; runOnJS(setDragging)(true); })
    .onChange(e => {
    let nx1 = clamp(x1.value + e.changeX, left, right);
    let ny1 = clamp(y1.value + e.changeY, top, bottom);
    let nx2 = clamp(x2.value + e.changeX, left, right);
    let ny2 = clamp(y2.value + e.changeY, top, bottom);
    const r = applyLockSnap(nx1, ny1, nx2, ny2);
    x1.value = r.x1; y1.value = r.y1; x2.value = r.x2; y2.value = r.y2;
    }).onFinalize(() => {
    activeC.value = 0; runOnJS(setDragging)(false);
    if (onChange) runOnJS(onChange)([{ x: x1.value, y: y1.value }, { x: x2.value, y: y2.value }]);
    });

  const pinch = Gesture.Pinch().onBegin(() => { activeC.value = 1; runOnJS(setDragging)(true); }).onChange(e => {
    const cx = centerX.value;
    const cy = centerY.value;
    const vx = (x2.value - x1.value) / 2;
    const vy = (y2.value - y1.value) / 2;
    let nvx = vx * e.scale;
    let nvy = vy * e.scale;
    let nx1 = cx - nvx;
    let ny1 = cy - nvy;
    let nx2 = cx + nvx;
    let ny2 = cy + nvy;
    nx1 = clamp(nx1, left, right);
    ny1 = clamp(ny1, top, bottom);
    nx2 = clamp(nx2, left, right);
    ny2 = clamp(ny2, top, bottom);
    const r = applyLockSnap(nx1, ny1, nx2, ny2);
    x1.value = r.x1; y1.value = r.y1; x2.value = r.x2; y2.value = r.y2;
    }).onFinalize(() => {
    activeC.value = 0; runOnJS(setDragging)(false);
    if (onChange) runOnJS(onChange)([{ x: x1.value, y: y1.value }, { x: x2.value, y: y2.value }]);
    });

  const tap = Gesture.Tap().maxDistance(10).onEnd((e, s) => {
    if (!s) return;
    const tx = clamp(e.x, left, right);
    const ty = clamp(e.y, top, bottom);
    const d1 = dist(tx, ty, x1.value, y1.value);
    const d2 = dist(tx, ty, x2.value, y2.value);
    const dc = dist(tx, ty, centerX.value, centerY.value);
    if (dc < 48) {
      const dx = tx - centerX.value;
      const dy = ty - centerY.value;
      const nx1 = clamp(x1.value + dx, left, right);
      const ny1 = clamp(y1.value + dy, top, bottom);
      const nx2 = clamp(x2.value + dx, left, right);
      const ny2 = clamp(y2.value + dy, top, bottom);
      x1.value = withSpring(nx1);
      y1.value = withSpring(ny1);
      x2.value = withSpring(nx2);
      y2.value = withSpring(ny2);
      runOnJS(Haptics.selectionAsync)();
      if (onChange) runOnJS(onChange)([{ x: nx1, y: ny1 }, { x: nx2, y: ny2 }]);
      return;
    }
    if (d1 <= d2) {
      x1.value = withSpring(tx);
      y1.value = withSpring(ty);
      runOnJS(Haptics.selectionAsync)();
      if (onChange) runOnJS(onChange)([{ x: tx, y: ty }, { x: x2.value, y: y2.value }]);
    } else {
      x2.value = withSpring(tx);
      y2.value = withSpring(ty);
      runOnJS(Haptics.selectionAsync)();
      if (onChange) runOnJS(onChange)([{ x: x1.value, y: y1.value }, { x: tx, y: ty }]);
    }
  });
  tap.requireExternalGestureToFail(pan1);
  tap.requireExternalGestureToFail(pan2);
  tap.requireExternalGestureToFail(panGrip);

  const composed = Gesture.Simultaneous(Gesture.Race(pan1, pan2, panGrip), pinch, tap);

  const lineProps = useAnimatedProps(() => ({ x1: x1.value, y1: y1.value, x2: x2.value, y2: y2.value }));
  const dashProps = useAnimatedProps(() => ({ x1: x1.value, y1: y1.value, x2: x2.value, y2: y2.value, strokeDasharray: [8, 10], strokeDashoffset: dash.value }));

  const h1Style = useAnimatedStyle(() => ({ transform: [{ translateX: x1.value - 24 }, { translateY: y1.value - 24 }, { scale: withSpring(active1.value ? 1.1 : 1) }] }));
  const h2Style = useAnimatedStyle(() => ({ transform: [{ translateX: x2.value - 24 }, { translateY: y2.value - 24 }, { scale: withSpring(active2.value ? 1.1 : 1) }] }));
  const gripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: centerX.value - 36 }, { translateY: centerY.value - 18 }, { rotate: `${ang.value}rad` }, { scale: withSpring(activeC.value ? 1.05 : 1) }] }));
  const labelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: centerX.value + 12 }, { translateY: centerY.value - 36 }], opacity: withTiming(1) }));
  const AnimatedText = useMemo(() => Animated.createAnimatedComponent(Text), []);
  const labelProps = useAnimatedProps(() => ({ text: `${Math.round(len.value)} px` }));

  const phase = useSharedValue(0);
  React.useEffect(() => { phase.value = withRepeat(withTiming(2 * Math.PI, { duration: 1600, easing: Easing.linear }), -1, false); }, []);
  const Tick = ({ t }) => {
    const tickProps = useAnimatedProps(() => {
      const px = x1.value + (x2.value - x1.value) * t; const py = y1.value + (y2.value - y1.value) * t; const vx = x2.value - x1.value; const vy = y2.value - y1.value; const L = Math.hypot(vx, vy) || 1; const nx = -vy / L; const ny = vx / L; const len = 8 + 4 * Math.sin(phase.value + t * 6.28); const hx = nx * len * 0.5; const hy = ny * len * 0.5; return { x1: px - hx, y1: py - hy, x2: px + hx, y2: py + hy };
    });
    return <AnimatedLine animatedProps={tickProps} stroke={colorMain} strokeOpacity={0.45} strokeWidth={2} strokeLinecap="round" />;
  };
  const ticks = useMemo(() => Array.from({ length: 16 }, (_, i) => (i + 1) / 17), []);

  return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colorMain} stopOpacity="1" />
              <Stop offset="1" stopColor={colorMain} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <AnimatedLine animatedProps={lineProps} stroke="url(#g1)" strokeWidth={18} strokeOpacity={0.2} strokeLinecap="round" />
          <AnimatedLine animatedProps={dashProps} stroke="url(#g1)" strokeWidth={6} strokeLinecap="round" />
          {ticks.map((tt, i) => (<Tick key={i} t={tt} />))}
          <AnimatedCircle animatedProps={useAnimatedProps(() => ({ cx: x1.value, cy: y1.value }))} r={22} fill={colorMain} opacity={0.15} />
          <AnimatedCircle animatedProps={useAnimatedProps(() => ({ cx: x1.value, cy: y1.value }))} r={12} fill={colorMain} opacity={0.35} />
          <AnimatedCircle animatedProps={useAnimatedProps(() => ({ cx: x1.value, cy: y1.value }))} r={6} fill={colorMain} />
          <AnimatedCircle animatedProps={useAnimatedProps(() => ({ cx: x2.value, cy: y2.value }))} r={22} fill={colorMain} opacity={0.15} />
          <AnimatedCircle animatedProps={useAnimatedProps(() => ({ cx: x2.value, cy: y2.value }))} r={12} fill={colorMain} opacity={0.35} />
          <AnimatedCircle animatedProps={useAnimatedProps(() => ({ cx: x2.value, cy: y2.value }))} r={6} fill={colorMain} />
        </Svg>
        {enableTap && (
          <GestureDetector gesture={tap}>
            <View style={StyleSheet.absoluteFill} />
          </GestureDetector>
        )}
        <GestureDetector gesture={pan1}>
          <Animated.View style={[styles.handle, styles.shadow, { backgroundColor: colorMain }, h1Style]} />
        </GestureDetector>
        <GestureDetector gesture={pan2}>
          <Animated.View style={[styles.handle, styles.shadow, { backgroundColor: colorMain }, h2Style]} />
        </GestureDetector>
        <GestureDetector gesture={Gesture.Simultaneous(panGrip, pinch)}>
          <Animated.View style={[styles.centerGrip, styles.shadow, { borderColor: colorMain }, gripStyle]} />
        </GestureDetector>
        {showLabel && (
          <Animated.View style={[styles.label, labelStyle]}>
            <AnimatedText animatedProps={labelProps} style={styles.labelText} />
          </Animated.View>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  handle: { position: 'absolute', width: 48, height: 48, borderRadius: 24 },
  centerGrip: { position: 'absolute', width: 72, height: 36, borderRadius: 18, backgroundColor: 'rgba(15,22,34,0.75)', borderWidth: 2 },
  shadow: { shadowColor: '#00E5A8', shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  label: { position: 'absolute', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)' },
  labelText: { color: '#D9E1F2', fontSize: 12, fontWeight: '700' },
});
