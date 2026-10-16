import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** iOS sheet curve (UIKit's default spring is approximated well by this bezier). */
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const DURATION = 380;

/**
 * Bottom sheet that behaves like an iOS page sheet:
 * - drag the grip/header, or the content when it is scrolled to the top, to pull it down
 * - it follows the finger 1:1, resists when pulled up, and the backdrop fades with it
 * - release past ~25% of its height or with a downward flick to dismiss, otherwise it springs back
 * - the close button, a tap on the backdrop and Esc all play the same slide-down
 */
export function Sheet({
  title,
  onClose,
  children,
  actions,
  dismissible = true,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  /** false while something must finish (e.g. an upload): no swipe, no close button. */
  dismissible?: boolean;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  const setOffset = useCallback((y: number, animate: boolean) => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;
    const t = animate ? `transform ${DURATION}ms ${EASE}` : 'none';
    sheet.style.transition = t;
    sheet.style.transform = y ? `translate3d(0, ${y}px, 0)` : '';
    backdrop.style.transition = animate ? `opacity ${DURATION}ms ${EASE}` : 'none';
    backdrop.style.opacity = String(Math.max(0, 1 - Math.max(0, y) / Math.max(1, sheet.offsetHeight)));
  }, []);

  const animateClose = useCallback(() => {
    if (closing.current || !dismissibleRef.current) return;
    closing.current = true;
    const h = sheetRef.current?.offsetHeight ?? 600;
    setOffset(h + 40, true);
    // Fallback timer: transitionend never fires with reduced motion.
    window.setTimeout(() => onCloseRef.current(), DURATION);
  }, [setOffset]);

  // Esc, focus, background scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && animateClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [animateClose]);

  // Drag to dismiss (touch + mouse/pen via pointer events).
  useEffect(() => {
    const sheet = sheetRef.current;
    const body = bodyRef.current;
    if (!sheet || !body) return;

    let startY = 0;
    let velocity = 0; // px per ms, positive = downward
    let samples: { y: number; t: number }[] = [];
    let tracking = false; // finger down and we might take over
    let dragging = false; // we own the gesture
    let offset = 0;
    let pointerId: number | null = null;
    let suppressClick = false;

    const canStart = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el || !dismissibleRef.current || closing.current) return false;
      // Let sliders, text selection and the embedded viewers keep their own gestures.
      if (el.closest('input[type="range"], textarea, iframe, [data-no-sheet-drag]')) return false;
      return true;
    };

    const begin = (y: number, target: EventTarget | null) => {
      tracking = canStart(target);
      dragging = false;
      startY = y;
      samples = [{ y, t: performance.now() }];
      velocity = 0;
      offset = 0;
    };

    /** Returns true when the event should be swallowed (we're dragging the sheet). */
    const move = (y: number, target: EventTarget | null): boolean => {
      if (!tracking) return false;
      const dy = y - startY;
      if (!dragging) {
        const inBody = body.contains(target as Node);
        // Inside the content, only take over at the top and on a downward pull, like iOS.
        if (inBody && body.scrollTop > 0) {
          tracking = false;
          return false;
        }
        if (dy > 6) {
          dragging = true;
          startY += 6; // take over without a jump, keep the distance already travelled
        } else if (dy < -6) {
          tracking = false; // scrolling the content up
          return false;
        } else return false;
      }
      // Release velocity = movement over the last ~100 ms (what UIKit uses for flicks).
      const now = performance.now();
      samples.push({ y, t: now });
      while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
      const first = samples[0];
      velocity = (y - first.y) / Math.max(1, now - first.t);
      const raw = y - startY;
      // Rubber band when pulled above the resting position.
      offset = raw >= 0 ? raw : -Math.sqrt(-raw) * 3;
      setOffset(offset, false);
      return true;
    };

    const end = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      // A drag that began on a button must not also "click" it.
      suppressClick = true;
      window.setTimeout(() => (suppressClick = false), 0);
      const h = sheet.offsetHeight;
      if (offset > h * 0.25 || (velocity > 0.5 && offset > 12)) animateClose();
      else setOffset(0, true);
    };

    // Touch: needs a non-passive listener so we can stop the content from scrolling while dragging.
    const onTouchStart = (e: TouchEvent) => begin(e.touches[0].clientY, e.target);
    const onTouchMove = (e: TouchEvent) => {
      if (move(e.touches[0].clientY, e.target) && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = () => end();

    // Mouse / pen (desktop browsers, iPad with a trackpad).
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      pointerId = e.pointerId;
      begin(e.clientY, e.target);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (move(e.clientY, e.target)) {
        e.preventDefault();
        if (!sheet.hasPointerCapture(e.pointerId)) sheet.setPointerCapture(e.pointerId);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      end();
    };

    const onClickCapture = (e: MouseEvent) => {
      if (suppressClick) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    sheet.addEventListener('click', onClickCapture, true);
    sheet.addEventListener('touchstart', onTouchStart, { passive: true });
    sheet.addEventListener('touchmove', onTouchMove, { passive: false });
    sheet.addEventListener('touchend', onTouchEnd);
    sheet.addEventListener('touchcancel', onTouchEnd);
    sheet.addEventListener('pointerdown', onPointerDown);
    sheet.addEventListener('pointermove', onPointerMove);
    sheet.addEventListener('pointerup', onPointerUp);
    sheet.addEventListener('pointercancel', onPointerUp);
    return () => {
      sheet.removeEventListener('click', onClickCapture, true);
      sheet.removeEventListener('touchstart', onTouchStart);
      sheet.removeEventListener('touchmove', onTouchMove);
      sheet.removeEventListener('touchend', onTouchEnd);
      sheet.removeEventListener('touchcancel', onTouchEnd);
      sheet.removeEventListener('pointerdown', onPointerDown);
      sheet.removeEventListener('pointermove', onPointerMove);
      sheet.removeEventListener('pointerup', onPointerUp);
      sheet.removeEventListener('pointercancel', onPointerUp);
    };
  }, [animateClose, setOffset]);

  return createPortal(
    <>
      <div className="sheet-backdrop" ref={backdropRef} onClick={animateClose} />
      <div className="sheet" role="dialog" aria-modal="true" tabIndex={-1} ref={sheetRef}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2 className="ellipsis">{title}</h2>
          {actions}
          {dismissible && (
            <button className="icon-btn" onClick={animateClose} aria-label="關閉">
              <X size={20} />
            </button>
          )}
        </div>
        <div className="sheet-body" ref={bodyRef}>
          {children}
        </div>
      </div>
    </>,
    document.body,
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}
