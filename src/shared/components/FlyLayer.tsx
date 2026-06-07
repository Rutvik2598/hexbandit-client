/**
 * FlyLayer — animated resource tokens that arc between the bank and
 * the player's hand stacks. Uses DOM IDs to locate anchor positions:
 *   bank:  id="bank-anchor-{resourceKey}"
 *   stack: id="stack-anchor-{resourceKey}"
 *
 * Trigger via the exported flyResource() utility or by dispatching a
 * "hexfly" CustomEvent on window directly.
 */
import { useState, useEffect, useRef } from 'react';
import { ResourceIcon } from './ResourceIcon';

export interface HexFlyDetail {
  key: string;
  dir: 'gain' | 'spend';
  n?: number;
  stagger?: number;
  onArrive?: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export function flyResource(
  key: string,
  dir: 'gain' | 'spend',
  n = 1,
  onArrive?: () => void,
): void {
  window.dispatchEvent(
    new CustomEvent<HexFlyDetail>('hexfly', { detail: { key, dir, n, onArrive } }),
  );
}

// ---- internal types ----

interface Token {
  id: number;
  rkey: string;
  dir: 'gain' | 'spend';
  from: { x: number; y: number };
  to: { x: number; y: number };
  jitter: number;
  lift: number;
  delay: number;
}

function center(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// ---- FlyToken ----

function FlyToken({ rkey, dir, from, to, jitter, lift, delay }: Omit<Token, 'id'>) {
  const [p, setP] = useState(0);

  useEffect(() => {
    const DUR = 640;
    let raf: number;
    let start: number;

    const begin = () => {
      start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / DUR);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        setP(e);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const timer = setTimeout(begin, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [delay]);

  // quadratic bezier arc
  const cx = (from.x + to.x) / 2 + jitter;
  const cy = Math.min(from.y, to.y) - lift;
  const x = (1 - p) * (1 - p) * from.x + 2 * (1 - p) * p * cx + p * p * to.x;
  const y = (1 - p) * (1 - p) * from.y + 2 * (1 - p) * p * cy + p * p * to.y;

  const appear = Math.min(1, p / 0.12);
  const vanish = p > 0.86 ? (1 - (p - 0.86) / 0.14) : 1;
  const scale = (dir === 'gain' ? 0.7 + p * 0.55 : 1.15 - p * 0.5) * appear * (0.4 + vanish * 0.6);
  const spin  = (dir === 'gain' ? 1 : -1) * p * 220;
  const glow  = dir === 'gain' ? 'rgba(96,180,120,0.65)' : 'rgba(240,169,58,0.6)';

  return (
    <div style={{
      position: 'fixed',
      left: 0,
      top: 0,
      transform: `translate(${x}px,${y}px) translate(-50%,-50%) scale(${scale}) rotate(${spin}deg)`,
      opacity: appear * vanish,
      willChange: 'transform, opacity',
      pointerEvents: 'none',
    }}>
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        <div style={{
          position: 'absolute', width: 46, height: 46, borderRadius: '50%',
          background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          filter: 'blur(2px)',
        }} />
        <div style={{
          position: 'relative', width: 40, height: 40, borderRadius: 9,
          background: 'linear-gradient(168deg,#f8f3e9,#e2d7c2)',
          border: '1px solid rgba(40,30,15,0.3)',
          boxShadow: '0 6px 14px -4px rgba(0,0,0,0.6)',
          display: 'grid', placeItems: 'center',
        }}>
          <ResourceIcon type={rkey} size={28} shadow={false} />
        </div>
      </div>
    </div>
  );
}

// ---- FlyLayer (mount once at root) ----

export function FlyLayer() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    function onFly(e: Event) {
      const { key, dir, n = 1, stagger = 90, onArrive } = (e as CustomEvent<HexFlyDetail>).detail ?? {};
      const bankEl  = document.getElementById(`bank-anchor-${key}`);
      const stackEl = document.getElementById(`stack-anchor-${key}`);
      if (!bankEl || !stackEl) { onArrive?.(); return; }

      const bank  = center(bankEl);
      const stack = center(stackEl);
      const from  = dir === 'gain' ? bank  : stack;
      const to    = dir === 'gain' ? stack : bank;

      const count = Math.min(n, 6);
      const batch: Token[] = Array.from({ length: count }, (_, i) => ({
        id:     ++idRef.current,
        rkey:   key,
        dir,
        from,
        to,
        jitter: (Math.random() - 0.5) * 36,
        lift:   80 + Math.random() * 60,
        delay:  i * stagger,
      }));

      setTokens(t => [...t, ...batch]);

      if (onArrive) {
        const arriveAt = (count - 1) * stagger + 640 + 30;
        setTimeout(onArrive, arriveAt);
      }

      const ttl = 720 + (count - 1) * stagger + 200;
      batch.forEach(b => setTimeout(() => setTokens(t => t.filter(x => x.id !== b.id)), ttl));
    }

    window.addEventListener('hexfly', onFly);
    return () => window.removeEventListener('hexfly', onFly);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9000 }}>
      {tokens.map(t => <FlyToken key={t.id} {...t} />)}
    </div>
  );
}
