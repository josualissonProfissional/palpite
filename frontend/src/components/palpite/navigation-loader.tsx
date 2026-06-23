"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppLoadingScreen } from "@/components/palpite/app-loading";

const MIN_VISIBLE_MS = 500;

export function NavigationLoader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setVisible(true);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        timerRef.current = null;
      }, MIN_VISIBLE_MS);
    } else if (prevPathname.current === pathname) {
      // Initial mount or same path - don't show loader
      prevPathname.current = pathname;
    }
  }, [pathname]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      {visible && <AppLoadingScreen />}
      {children}
    </>
  );
}
