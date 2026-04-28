import * as React from 'react';
import { expect } from 'vitest';
import { createRenderer } from '#test-utils';
import { CompositeList } from './CompositeList';
import { useCompositeListItem } from './useCompositeListItem';

describe('<CompositeList />', () => {
  const { render } = createRenderer();

  describe('prop: elementsRef', () => {
    it('cleans up refs on unmount', async () => {
      function Item() {
        const { ref } = useCompositeListItem();
        return <div ref={ref} />;
      }
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const labelsRef = {
        current: [] as Array<string | null>,
      };
      const { unmount } = await render(
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <Item />
          <Item />
          <Item />
        </CompositeList>,
      );

      expect(elementsRef.current).toHaveLength(3);
      expect(labelsRef.current).toHaveLength(3);

      unmount();
      expect(elementsRef.current).toHaveLength(0);
      expect(labelsRef.current).toHaveLength(0);
    });
  });

  // Regression coverage for https://github.com/mui/base-ui/issues/<issue-number>:
  // In React.StrictMode, the cleanup effects in `CompositeList` run twice but the
  // ref callbacks in `useCompositeListItem` only fire once (the DOM is not
  // re-mounted). Without the fix, `elementsRef.current` ends up with the right
  // length but `undefined` slots, and `labelsRef.current` loses its values. That
  // breaks any consumer that does `elementsRef.current.indexOf(liveNode)` — e.g.
  // Floating UI's `useListNavigation`, which is how `<Select>`'s mouse-hover
  // selection bails (`activeIndex` never moves, so item clicks become no-ops).
  describe('in <React.StrictMode>', () => {
    it('populates elementsRef with the live DOM nodes so indexOf(liveNode) succeeds', async () => {
      function Item({ children }: { children: React.ReactNode }) {
        const { ref } = useCompositeListItem();
        return <div ref={ref}>{children}</div>;
      }
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const labelsRef = {
        current: [] as Array<string | null>,
      };
      const { container } = await render(
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <Item>One</Item>
          <Item>Two</Item>
          <Item>Three</Item>
        </CompositeList>,
        { strict: true },
      );

      const liveNodes = Array.from(container.querySelectorAll('div'));
      expect(liveNodes).toHaveLength(3);
      expect(elementsRef.current).toHaveLength(3);

      // No empty slots — every entry must reference an HTMLElement.
      expect(elementsRef.current.every((node) => node instanceof HTMLElement)).toBe(true);

      // Every rendered DOM node is findable in elementsRef. This is the exact
      // lookup `useListNavigation.syncCurrentTarget` performs on each pointer
      // event; if it returns -1, hover detection is silently broken.
      liveNodes.forEach((node) => {
        expect(elementsRef.current.indexOf(node)).not.toBe(-1);
      });
    });

    it('repopulates elementsRef and labelsRef after a manual wipe when items register', async () => {
      // Targeted regression: simulates the exact failure mode the fix
      // recovers from — `elementsRef.current` and `labelsRef.current` have
      // been wiped (e.g. by a previous cleanup effect's double-invoke under
      // StrictMode) and the existing items' ref callbacks do not re-fire
      // (because their DOM nodes haven't unmounted). When subsequent items
      // register and the mapTick effect runs, the existing items must be
      // re-discovered from the internal sortedMap; otherwise their slots
      // remain empty and `listRef.current.indexOf(liveNode) === -1` for
      // every previously-mounted item.
      function Item({ children }: { children: React.ReactNode }) {
        const { ref } = useCompositeListItem();
        return <div ref={ref}>{children}</div>;
      }

      function Harness({ count }: { count: number }) {
        const items = Array.from({ length: count }, (_, i) => (
          <Item key={i}>Item {i + 1}</Item>
        ));
        return <>{items}</>;
      }

      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const labelsRef = {
        current: [] as Array<string | null>,
      };

      const { container, setProps } = await render(
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <Harness count={3} />
        </CompositeList>,
        { strict: true },
      );

      // Wipe the refs as if the cleanup-without-reattach race condition
      // happened. The DOM nodes are still mounted; the internal sortedMap
      // still references them.
      elementsRef.current = new Array(3).fill(null);
      labelsRef.current = new Array(3).fill(null);

      // Add a 4th item — this triggers register/sortedMap-change and runs
      // the mapTick effect, which should re-populate the prior 3 entries
      // from sortedMap and the new 4th entry via its own ref callback.
      await setProps({
        children: <Harness count={4} />,
      });

      const liveNodes = Array.from(container.querySelectorAll('div'));
      expect(liveNodes).toHaveLength(4);
      expect(elementsRef.current).toHaveLength(4);

      // All four slots populated — including the three that were wiped.
      expect(elementsRef.current.every((node) => node instanceof HTMLElement)).toBe(true);
      liveNodes.forEach((node) => {
        expect(elementsRef.current.indexOf(node)).not.toBe(-1);
      });

      // Labels also recovered for the previously-mounted items.
      expect(labelsRef.current).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4']);
    });

    it('populates labelsRef from textContent', async () => {
      function Item({ children }: { children: React.ReactNode }) {
        const { ref } = useCompositeListItem();
        return <div ref={ref}>{children}</div>;
      }
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const labelsRef = {
        current: [] as Array<string | null>,
      };
      await render(
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <Item>Apple</Item>
          <Item>Banana</Item>
          <Item>Cherry</Item>
        </CompositeList>,
        { strict: true },
      );

      expect(labelsRef.current).toEqual(['Apple', 'Banana', 'Cherry']);
    });

    it('populates labelsRef from the explicit `label` parameter', async () => {
      function Item({ label }: { label: string }) {
        const { ref } = useCompositeListItem({ label });
        return <div ref={ref} />;
      }
      const elementsRef = {
        current: [] as Array<HTMLElement | null>,
      };
      const labelsRef = {
        current: [] as Array<string | null>,
      };
      await render(
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          <Item label="Strawberry" />
          <Item label="Pistachio" />
          <Item label="Hazelnut" />
        </CompositeList>,
        { strict: true },
      );

      expect(labelsRef.current).toEqual(['Strawberry', 'Pistachio', 'Hazelnut']);
    });
  });
});
