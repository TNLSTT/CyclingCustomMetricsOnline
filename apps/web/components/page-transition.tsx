'use client';

import { useMemo, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { motion } from 'framer-motion';

const transition = { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] as [number, number, number, number] };

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const initial = useMemo(() => ({ opacity: 0, transform: 'translateY(12px)' }), []);
  const animate = useMemo(() => ({ opacity: 1, transform: 'translateY(0)' }), []);

  return (
    <motion.div key={pathname} initial={initial} animate={animate} transition={transition} className="h-full">
      {children}
    </motion.div>
  );
}
