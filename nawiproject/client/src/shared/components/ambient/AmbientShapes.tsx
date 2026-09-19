import { useEffect, useRef } from 'react';

type AmbientVariant = 'login' | 'dashboard';
type Motion = { x: number; y: number; rotation: number; scale: number };
type MotionPath = (seconds: number) => Motion;

const compositions: Record<AmbientVariant, { shapeClasses: string[]; paths: MotionPath[]; phaseOffsets: number[]; opacities?: number[]; compactOpacities?: number[] }> = {
  login: {
    shapeClasses: ['auth-shape auth-shape-one', 'auth-shape auth-shape-two', 'auth-shape auth-shape-three', 'auth-shape auth-shape-four'],
    phaseOffsets: [0, 0, 0, 0],
    paths: [
      seconds => ({ x: Math.sin(seconds * .78) * 70 + Math.cos(seconds * .36) * 18, y: Math.cos(seconds * .64) * 55, rotation: Math.sin(seconds * .28) * 5, scale: 1 + Math.sin(seconds * .42) * .035 }),
      seconds => ({ x: Math.cos(seconds * .61) * 62, y: Math.sin(seconds * .73) * 70 + Math.cos(seconds * .29) * 15, rotation: Math.cos(seconds * .31) * 6, scale: 1 + Math.cos(seconds * .38) * .045 }),
      seconds => ({ x: Math.sin(seconds * .52) * 76, y: Math.cos(seconds * .67) * 54, rotation: Math.sin(seconds * .24) * 4, scale: 1 + Math.sin(seconds * .33) * .04 }),
      seconds => ({ x: Math.cos(seconds * .88) * 45, y: Math.sin(seconds * .58) * 42, rotation: Math.sin(seconds * .45) * 7, scale: 1 + Math.cos(seconds * .52) * .06 }),
    ],
  },
  dashboard: {
    shapeClasses: ['dashboard-shape dashboard-shape-one', 'dashboard-shape dashboard-shape-two', 'dashboard-shape dashboard-shape-three', 'dashboard-shape dashboard-shape-four', 'dashboard-shape dashboard-shape-five', 'dashboard-shape dashboard-shape-six', 'dashboard-shape dashboard-shape-seven', 'dashboard-shape dashboard-shape-eight', 'dashboard-shape dashboard-shape-nine', 'dashboard-shape dashboard-shape-ten'],
    phaseOffsets: [1.4, -0.8, 2.2, -1.7, 0.55, 2.9, -2.4, 1.15, -1.35, 3.6],
    // Keep the dashboard scene visible even when a cached stylesheet is still
    // present in a running development tab. CSS remains responsible for
    // responsive sizing; this JS value owns only the decorative intensity.
    opacities: [.48, .42, .3, .32, .55, .22, .32, .38, .22, .38],
    compactOpacities: [.34, .29, .2, .32, .5, .14, .35, .3, .16, .4],
    paths: [
      seconds => ({ x: Math.sin(seconds * .31) * 52 + Math.cos(seconds * .17) * 14, y: Math.cos(seconds * .24) * 36, rotation: Math.sin(seconds * .16) * 3, scale: 1 + Math.sin(seconds * .22) * .028 }),
      seconds => ({ x: Math.cos(seconds * .27) * 38, y: Math.sin(seconds * .35) * 45 + Math.cos(seconds * .13) * 12, rotation: Math.cos(seconds * .19) * 4, scale: 1 + Math.cos(seconds * .18) * .035 }),
      seconds => ({ x: Math.sin(seconds * .21) * 58, y: Math.cos(seconds * .29) * 28, rotation: Math.sin(seconds * .12) * 3, scale: 1 + Math.sin(seconds * .17) * .025 }),
      seconds => ({ x: Math.cos(seconds * .39) * 27, y: Math.sin(seconds * .26) * 32, rotation: Math.sin(seconds * .2) * 5, scale: 1 + Math.cos(seconds * .24) * .04 }),
      seconds => ({ x: Math.sin(seconds * .47) * 20, y: Math.cos(seconds * .33) * 24, rotation: Math.cos(seconds * .22) * 4, scale: 1 + Math.sin(seconds * .3) * .03 }),
      seconds => ({ x: Math.cos(seconds * .18) * 34, y: Math.sin(seconds * .25) * 20, rotation: Math.sin(seconds * .14) * 3, scale: 1 + Math.cos(seconds * .2) * .022 }),
      seconds => ({ x: Math.sin(seconds * .36) * 28, y: Math.cos(seconds * .2) * 30, rotation: Math.cos(seconds * .17) * 4, scale: 1 + Math.sin(seconds * .26) * .026 }),
      seconds => ({ x: Math.cos(seconds * .23) * 42, y: Math.sin(seconds * .16) * 26, rotation: Math.sin(seconds * .11) * 3, scale: 1 + Math.cos(seconds * .19) * .024 }),
      seconds => ({ x: Math.sin(seconds * .29) * 24, y: Math.cos(seconds * .22) * 34, rotation: Math.cos(seconds * .15) * 4, scale: 1 + Math.sin(seconds * .2) * .028 }),
      seconds => ({ x: Math.cos(seconds * .54) * 16, y: Math.sin(seconds * .43) * 18, rotation: Math.sin(seconds * .3) * 5, scale: 1 + Math.cos(seconds * .37) * .035 }),
    ],
  },
};

export default function AmbientShapes({ variant }: { variant: AmbientVariant }) {
  const shapeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const composition = compositions[variant];

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const compactQuery = window.matchMedia('(max-width: 650px)');
    let frame = 0;
    const opacityValues = () => compactQuery.matches ? (composition.compactOpacities || composition.opacities) : composition.opacities;

    const applyMotion = (seconds: number, motionScale: number) => {
      const opacities = opacityValues();
      composition.paths.forEach((path, index) => {
        const shape = shapeRefs.current[index];
        if (!shape) return;
        const motion = path(seconds + composition.phaseOffsets[index]);
        if (opacities) shape.style.opacity = String(opacities[index]);
        shape.style.transform = `translate3d(${motion.x * motionScale}px, ${motion.y * motionScale}px, 0) rotate(${motion.rotation * motionScale}deg) scale(${1 + ((motion.scale - 1) * motionScale)})`;
      });
    };

    const animate = (time: number) => {
      applyMotion(time / 1000, 1);
      frame = window.requestAnimationFrame(animate);
    };

    if (mediaQuery.matches) {
      applyMotion(0, 0);
    } else {
      frame = window.requestAnimationFrame(animate);
    }

    const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
      if (frame) window.cancelAnimationFrame(frame);
      if (event.matches) applyMotion(0, 0);
      else frame = window.requestAnimationFrame(animate);
    };
    mediaQuery.addEventListener?.('change', handleMotionPreferenceChange);
    const handleCompactChange = () => applyMotion(0, mediaQuery.matches ? 0 : 1);
    compactQuery.addEventListener?.('change', handleCompactChange);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener?.('change', handleMotionPreferenceChange);
      compactQuery.removeEventListener?.('change', handleCompactChange);
    };
  }, [composition]);

  return <div className={`ambient-shapes ambient-shapes-${variant}`} aria-hidden="true">
    {composition.shapeClasses.map((className, index) => <span ref={node => { shapeRefs.current[index] = node; }} className={className} key={className} />)}
  </div>;
}
