'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useCompositeListContext } from './CompositeListContext';

export interface UseCompositeListItemParameters<Metadata> {
  index?: number | undefined;
  label?: string | null | undefined;
  metadata?: Metadata | undefined;
  textRef?: React.RefObject<HTMLElement | null> | undefined;
  /** Enables guessing the indexes. This avoids a re-render after mount, which is useful for
   * large lists. This should be used for lists that are likely flat and vertical, other cases
   * might trigger a re-render anyway. */
  indexGuessBehavior?: IndexGuessBehavior | undefined;
}

interface UseCompositeListItemReturnValue {
  ref: (node: HTMLElement | null) => void;
  index: number;
}

export enum IndexGuessBehavior {
  None,
  GuessFromOrder,
}

/**
 * Used to register a list item and its index (DOM position) in the `CompositeList`.
 */
export function useCompositeListItem<Metadata>(
  params: UseCompositeListItemParameters<Metadata> = {},
): UseCompositeListItemReturnValue {
  const { label, metadata, textRef, indexGuessBehavior, index: externalIndex } = params;

  const { register, unregister, subscribeMapChange, elementsRef, labelsRef, nextIndexRef } =
    useCompositeListContext();

  const indexRef = React.useRef(-1);
  const [index, setIndex] = React.useState<number>(
    externalIndex ??
      (indexGuessBehavior === IndexGuessBehavior.GuessFromOrder
        ? () => {
            if (indexRef.current === -1) {
              const newIndex = nextIndexRef.current;
              nextIndexRef.current += 1;
              indexRef.current = newIndex;
            }
            return indexRef.current;
          }
        : -1),
  );

  const componentRef = React.useRef<Element | null>(null);

  const syncLabel = React.useCallback(
    (node: HTMLElement, i: number) => {
      if (labelsRef) {
        const isLabelDefined = label !== undefined;
        labelsRef.current[i] = isLabelDefined
          ? label
          : (textRef?.current?.textContent ?? node.textContent);
      }
    },
    [labelsRef, label, textRef],
  );

  const ref = React.useCallback(
    (node: HTMLElement | null) => {
      componentRef.current = node;

      if (index !== -1 && node !== null) {
        elementsRef.current[index] = node;
        syncLabel(node, index);
      }
    },
    [index, elementsRef, syncLabel],
  );

  useIsoLayoutEffect(() => {
    if (externalIndex != null) {
      return undefined;
    }

    const node = componentRef.current;
    if (node) {
      register(node, metadata);
      return () => {
        unregister(node);
      };
    }
    return undefined;
  }, [externalIndex, register, unregister, metadata]);

  useIsoLayoutEffect(() => {
    if (externalIndex != null) {
      return undefined;
    }

    return subscribeMapChange((map) => {
      const node = componentRef.current;
      const i = node ? map.get(node)?.index : null;

      if (i != null) {
        setIndex(i);

        // Re-sync labelsRef unconditionally. In React StrictMode, the cleanup
        // effect in CompositeList wipes labelsRef.current, but ref callbacks
        // don't re-fire (the DOM is not unmounted), so labels are lost. Writing
        // them here recovers the values on every map change. This is a no-op in
        // the normal case because the ref callback already wrote the same label.
        syncLabel(node as HTMLElement, i);
      }
    });
  }, [externalIndex, subscribeMapChange, setIndex, syncLabel]);

  return React.useMemo(
    () => ({
      ref,
      index,
    }),
    [index, ref],
  );
}
