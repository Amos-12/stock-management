import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScanner {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minLength?: number;
  maxTimeBetweenKeys?: number;
}

export const useBarcodeScanner = ({
  onScan,
  enabled = true,
  minLength = 5,
  maxTimeBetweenKeys = 50
}: UseBarcodeScanner) => {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field (except search fields)
      const target = e.target as HTMLElement;
      const isSearchInput = target.getAttribute('data-barcode-input') === 'true';
      const isOtherInput = ['INPUT', 'TEXTAREA'].includes(target.tagName) && !isSearchInput;
      
      if (isOtherInput) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Reset buffer if too much time has passed (manual typing)
      if (timeDiff > maxTimeBetweenKeys && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Handle Enter key - trigger scan if buffer has enough characters
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          e.preventDefault();
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
        return;
      }

      // Only add printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        bufferRef.current += e.key;
        lastKeyTimeRef.current = now;

        // Auto-trigger after a brief pause if we have enough characters
        timeoutRef.current = setTimeout(() => {
          if (bufferRef.current.length >= minLength) {
            onScan(bufferRef.current);
            bufferRef.current = '';
          }
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, minLength, maxTimeBetweenKeys, onScan]);

  return { resetBuffer };
};
