// @ts-nocheck
'use client';

import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
} from 'react';

const DEFAULT_DURATION = 0.3;
const DEFAULT_EASE = 'ease-out';

function toTransitionString(transition?: MotionTransition): string | undefined {
  if (!transition) {
    return undefined;
  }

  const { duration = DEFAULT_DURATION, delay = 0, ease } = transition;
  let easing = DEFAULT_EASE;

  if (Array.isArray(ease) && ease.length === 4) {
    easing = `cubic-bezier(${ease.map((value) => Number(value).toFixed(3)).join(',')})`;
  } else if (typeof ease === 'string') {
    easing = ease;
  }

  return `all ${duration}s ${easing} ${delay}s`;
}

function serializeStyle(style?: CSSProperties): string {
  if (!style) {
    return '';
  }

  try {
    return JSON.stringify(style, Object.keys(style).sort());
  } catch (error) {
    return JSON.stringify(style);
  }
}

function serializeTransition(transition?: MotionTransition): string {
  if (!transition) {
    return '';
  }

  const cloned = { ...transition };
  if (Array.isArray(cloned.ease)) {
    cloned.ease = [...cloned.ease];
  }
  return JSON.stringify(cloned);
}

function combineStyles(
  baseStyle: CSSProperties | undefined,
  motionStyle: MotionStyle | undefined,
  transition: MotionTransition | undefined,
): CSSProperties {
  const composed: CSSProperties = { ...(baseStyle ?? {}) };

  if (motionStyle) {
    Object.assign(composed, motionStyle);
  }

  const transitionValue = toTransitionString(transition);
  if (transitionValue && !composed.transition) {
    composed.transition = transitionValue;
  }

  return composed;
}

type MotionElement = keyof JSX.IntrinsicElements;

export type MotionStyle = CSSProperties;

export type MotionTransition = {
  duration?: number;
  delay?: number;
  ease?: string | [number, number, number, number];
};

export type MotionProps<K extends MotionElement> = Omit<
  ComponentPropsWithoutRef<K>,
  'style' | 'onMouseEnter' | 'onMouseLeave' | 'onMouseDown' | 'onMouseUp' | 'onTouchStart' | 'onTouchEnd' | 'onFocus' | 'onBlur'
> & {
  style?: CSSProperties;
  initial?: MotionStyle;
  animate?: MotionStyle;
  exit?: MotionStyle;
  whileHover?: MotionStyle;
  whileTap?: MotionStyle;
  whileFocus?: MotionStyle;
  transition?: MotionTransition;
  children?: ReactNode;
};

function createMotionComponent<K extends MotionElement>(tag: K) {
  type ElementType = ComponentPropsWithoutRef<K>['ref'] extends ForwardedRef<infer R>
    ? R
    : K extends keyof HTMLElementTagNameMap
      ? HTMLElementTagNameMap[K]
      : HTMLElement;

  return forwardRef<ElementType, MotionProps<K>>(function MotionComponent(props, forwardedRef) {
    const {
      initial,
      animate,
      exit,
      whileHover,
      whileTap,
      whileFocus,
      transition,
      style,
      onMouseEnter,
      onMouseLeave,
      onMouseDown,
      onMouseUp,
      onTouchStart,
      onTouchEnd,
      onFocus,
      onBlur,
      children,
      ...rest
    } = props;

    const [baseStyle, setBaseStyle] = useState<CSSProperties>(() =>
      combineStyles(style, initial ?? animate ?? {}, transition ?? undefined),
    );
    const [isHover, setIsHover] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [isFocus, setIsFocus] = useState(false);

    const animateKey = useMemo(() => serializeStyle(animate), [animate]);
    const initialKey = useMemo(() => serializeStyle(initial), [initial]);
    const styleKey = useMemo(() => serializeStyle(style), [style]);
    const exitKey = useMemo(() => serializeStyle(exit), [exit]);
    const transitionKey = useMemo(() => serializeTransition(transition), [transition]);

    // We intentionally rely on serialized snapshots to avoid triggering animations
    // on shallow-equal objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
      let cancelled = false;

      setBaseStyle(combineStyles(style, initial ?? animate ?? {}, transition));

      const frame = requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }
        setBaseStyle(combineStyles(style, animate ?? {}, transition));
      });

      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }, [animateKey, initialKey, styleKey, transitionKey]);

    useEffect(() => {
      if (!exit) {
        return;
      }
      return () => {
        setBaseStyle(combineStyles(style, exit, transition));
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exitKey]);

    const resolvedStyle = useMemo(() => {
      let composed = { ...baseStyle };

      if (isHover && whileHover) {
        composed = combineStyles(composed, whileHover, transition);
      }
      if (isActive && whileTap) {
        composed = combineStyles(composed, whileTap, transition);
      }
      if (isFocus && whileFocus) {
        composed = combineStyles(composed, whileFocus, transition);
      }

      return composed;
    }, [baseStyle, whileHover, whileTap, whileFocus, isHover, isActive, isFocus, transition]);

    const handleMouseEnter: React.MouseEventHandler<ElementType> = (event) => {
      setIsHover(true);
      onMouseEnter?.(event);
    };

    const handleMouseLeave: React.MouseEventHandler<ElementType> = (event) => {
      setIsHover(false);
      setIsActive(false);
      onMouseLeave?.(event);
    };

    const handleMouseDown: React.MouseEventHandler<ElementType> = (event) => {
      setIsActive(true);
      onMouseDown?.(event);
    };

    const handleMouseUp: React.MouseEventHandler<ElementType> = (event) => {
      setIsActive(false);
      onMouseUp?.(event);
    };

    const handleTouchStart: React.TouchEventHandler<ElementType> = (event) => {
      setIsActive(true);
      onTouchStart?.(event);
    };

    const handleTouchEnd: React.TouchEventHandler<ElementType> = (event) => {
      setIsActive(false);
      onTouchEnd?.(event);
    };

    const handleFocus: React.FocusEventHandler<ElementType> = (event) => {
      setIsFocus(true);
      onFocus?.(event);
    };

    const handleBlur: React.FocusEventHandler<ElementType> = (event) => {
      setIsFocus(false);
      onBlur?.(event);
    };

    const Tag = tag as unknown as ElementType;

    return (
      <Tag
        {...(rest as Record<string, unknown>)}
        ref={forwardedRef}
        style={resolvedStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {children}
      </Tag>
    );
  });
}

export const motion = {
  div: createMotionComponent('div'),
  a: createMotionComponent('a'),
  button: createMotionComponent('button'),
  header: createMotionComponent('header'),
  main: createMotionComponent('main'),
  span: createMotionComponent('span'),
  ul: createMotionComponent('ul'),
  li: createMotionComponent('li'),
};

export function AnimatePresence({ children }: { children: ReactNode }): ReactElement | null {
  if (Array.isArray(children)) {
    return <>{children.filter(Boolean)}</>;
  }
  return <>{children}</>;
}

export const easeOut = DEFAULT_EASE;
