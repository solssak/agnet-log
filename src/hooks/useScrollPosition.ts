import { useEffect, useState, RefObject } from "react";

export function useScrollPosition(scrollRef: RefObject<HTMLElement | null>) {
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      const currentScrollY = element.scrollTop;
      setIsAtTop(currentScrollY < 10);
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, [scrollRef]);

  return { isAtTop };
}
