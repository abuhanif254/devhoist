'use client';

import React, { useEffect, useState } from 'react';

interface AnimatedPriceProps {
  amount: number;
  currencySymbol?: string;
  suffix?: string;
  className?: string;
  prefix?: string;
}

export default function AnimatedPrice({
  amount,
  currencySymbol = '৳',
  suffix = '/mo',
  className = '',
  prefix = '',
}: AnimatedPriceProps) {
  const [displayAmount, setDisplayAmount] = useState<number>(amount);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayAmount;
    const endValue = amount;
    const duration = 240; // ms smooth interpolation

    if (startValue === endValue) return;

    let frameId: number;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeProgress;
      setDisplayAmount(Number(current.toFixed(current % 1 === 0 ? 0 : 2)));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setDisplayAmount(endValue);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [amount]);

  return (
    <span className={`inline-flex items-baseline font-mono tabular-nums tracking-tight ${className}`}>
      {prefix && <span className="text-[0.8em] font-normal mr-1">{prefix}</span>}
      <span className="font-semibold">{currencySymbol}</span>
      <span className="font-bold tracking-tighter">
        {displayAmount.toLocaleString(undefined, {
          minimumFractionDigits: displayAmount % 1 !== 0 ? 2 : 0,
          maximumFractionDigits: 2,
        })}
      </span>
      {suffix && <span className="text-[0.65em] font-normal text-zinc-400 ml-0.5">{suffix}</span>}
    </span>
  );
}
