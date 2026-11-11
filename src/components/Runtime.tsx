'use client';

import { useEffect } from 'react';
import { installHooks } from '../hooks/site-hooks';
import { lamp } from '../lamp/lamp';
import { clock } from '../world/clock';
import { tiers } from '../world/tier';

// Starts the one clock, the lamp and the tier, and the test hooks when asked for. Renders nothing.
export function Runtime() {
  useEffect(() => {
    installHooks();
    tiers.detect();
    lamp.bind();
    clock.start();
  }, []);
  return null;
}
