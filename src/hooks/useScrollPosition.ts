import { useEffect, useState, RefObject } from "react";

export function useScrollPosition(scrollRef: RefObject<HTMLElement | null>) {
  const [scrollY, setScrollY] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      const currentScrollY = element.scrollTop;
      setScrollY(currentScrollY);
      setIsAtTop(currentScrollY < 10);
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, [scrollRef]);

  return { scrollY, isAtTop };
}
