import { useState, useEffect, useRef } from 'react';
import { TRANSITION_MS } from '../constants/geometry';

type Phase = 'entering' | 'active' | 'exiting';

export function useAnimatedTransition(trigger: unknown): string {
  const [phase, setPhase] = useState<Phase>('active');
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setPhase('exiting');

    const exitTimer = setTimeout(() => {
      setPhase('entering');
      const enterTimer = setTimeout(() => {
        setPhase('active');
      }, TRANSITION_MS);
      return () => clearTimeout(enterTimer);
    }, TRANSITION_MS);

    return () => clearTimeout(exitTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [String(trigger)]);

  return `zoom-transition zoom-transition--${phase}`;
}
