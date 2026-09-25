import { useEffect, useRef } from 'react';

export default function Logo({ dark = false, animated = false }: { dark?: boolean; animated?: boolean }) {
  const leftPan = useRef<SVGGElement>(null);
  const rightPan = useRef<SVGGElement>(null);
  useEffect(() => {
    if (!animated) return;
    const motionScale = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? .55 : 1;
    let frame = 0;
    const animate = (time: number) => {
      const lift = Math.sin(time / 520) * 3.2 * motionScale;
      if (leftPan.current) leftPan.current.style.transform = `translateY(${lift}px) rotate(${lift * .28}deg)`;
      if (rightPan.current) rightPan.current.style.transform = `translateY(${-lift}px) rotate(${-lift * .28}deg)`;
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [animated]);
  return <div className={`logo ${dark ? 'dark' : ''} ${animated ? 'animated-balance' : ''}`}><svg viewBox="0 0 40 34" aria-hidden="true"><path d="M20 4v22M7 9h26M10 27h20M14 30h12" /><g ref={leftPan} className="balance-pan balance-pan-left"><path d="M7 9l-5 11h10L7 9Z" /></g><g ref={rightPan} className="balance-pan balance-pan-right"><path d="M33 9l-5 11h10L33 9Z" /></g></svg><span>NAWI</span></div>;
}
