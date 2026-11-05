'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export type RevealDirection = 'left' | 'right' | 'up' | 'down' | 'none';

interface DirectionalRevealProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  direction?: RevealDirection;
  delay?: number;
  duration?: number;
  className?: string;
  distance?: number;
}

export default function DirectionalReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.5,
  distance = 35,
  className = '',
  ...props
}: DirectionalRevealProps) {
  let initialX = 0;
  let initialY = 0;

  if (direction === 'left') initialX = -distance;
  if (direction === 'right') initialX = distance;
  if (direction === 'up') initialY = distance;
  if (direction === 'down') initialY = -distance;

  return (
    <motion.div
      initial={{ opacity: 0, x: initialX, y: initialY }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        duration,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
