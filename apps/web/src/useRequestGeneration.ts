import { useEffect, useRef } from 'react';

// Advancing the generation invalidates a previous request, including after unmount.
export function useRequestGeneration() {
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  return generation;
}
