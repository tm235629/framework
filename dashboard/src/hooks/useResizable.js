import { useState, useCallback, useEffect, useRef } from 'react';

export function useResizable(initialWidth = 280, minWidth = 180, maxWidth = 500) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = width;
    setIsResizing(true);
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e) => {
      const diff = e.clientX - startX.current;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + diff));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing, minWidth, maxWidth]);

  return { width, isResizing, onMouseDown };
}
