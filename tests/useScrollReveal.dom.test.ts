import { vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// IntersectionObserver mock
let observerCallback: IntersectionObserverCallback;
let observerInstance: {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  observerInstance = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };

  class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      observerCallback = callback;
      Object.assign(this, observerInstance);
    }
    observe = observerInstance.observe;
    unobserve = observerInstance.unobserve;
    disconnect = observerInstance.disconnect;
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

import { useScrollReveal, useScrollRevealAll } from '@withwiz/pms/hooks/useScrollReveal';

describe('useScrollReveal 훅', () => {
  it('PMS-SR-01: ref 요소에 scroll-reveal 클래스 추가', () => {
    const div = document.createElement('div');
    const { result } = renderHook(() => useScrollReveal<HTMLDivElement>());

    // ref를 수동 설정
    Object.defineProperty(result.current, 'current', {
      value: div,
      writable: true,
    });

    // re-render to trigger useEffect with ref set
    const { unmount } = renderHook(() => {
      const ref = useScrollReveal<HTMLDivElement>();
      Object.defineProperty(ref, 'current', { value: div, writable: true });
      return ref;
    });

    expect(div.classList.contains('scroll-reveal')).toBe(true);
    unmount();
  });

  it('PMS-SR-02: IntersectionObserver 교차 시 scroll-reveal--visible 클래스 추가', () => {
    const div = document.createElement('div');

    renderHook(() => {
      const ref = useScrollReveal<HTMLDivElement>();
      Object.defineProperty(ref, 'current', { value: div, writable: true });
      return ref;
    });

    // observer callback 호출로 교차 시뮬레이션
    act(() => {
      observerCallback(
        [{ isIntersecting: true, target: div } as IntersectionObserverEntry],
        observerInstance as unknown as IntersectionObserver,
      );
    });

    expect(div.classList.contains('scroll-reveal--visible')).toBe(true);
    expect(observerInstance.unobserve).toHaveBeenCalledWith(div);
  });

  it('PMS-SR-03: 언마운트 시 observer disconnect 호출', () => {
    const div = document.createElement('div');

    const { unmount } = renderHook(() => {
      const ref = useScrollReveal<HTMLDivElement>();
      Object.defineProperty(ref, 'current', { value: div, writable: true });
      return ref;
    });

    unmount();
    expect(observerInstance.disconnect).toHaveBeenCalled();
  });
});

describe('useScrollRevealAll 훅', () => {
  it('PMS-SR-04: 선택자로 요소 선택 후 observe 호출', () => {
    const div1 = document.createElement('div');
    div1.classList.add('reveal-item');
    const div2 = document.createElement('div');
    div2.classList.add('reveal-item');
    document.body.appendChild(div1);
    document.body.appendChild(div2);

    renderHook(() => useScrollRevealAll('.reveal-item'));

    expect(div1.classList.contains('scroll-reveal')).toBe(true);
    expect(div2.classList.contains('scroll-reveal')).toBe(true);
    expect(observerInstance.observe).toHaveBeenCalledTimes(2);

    document.body.removeChild(div1);
    document.body.removeChild(div2);
  });

  it('PMS-SR-05: 언마운트 시 observer disconnect 호출', () => {
    const div = document.createElement('div');
    div.classList.add('reveal-cleanup');
    document.body.appendChild(div);

    const { unmount } = renderHook(() => useScrollRevealAll('.reveal-cleanup'));
    unmount();

    expect(observerInstance.disconnect).toHaveBeenCalled();
    document.body.removeChild(div);
  });
});
