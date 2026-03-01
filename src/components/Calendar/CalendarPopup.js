"use client";

import { useEffect, useRef } from "react";
import styles from "./Calendar.module.css";

export default function CalendarPopup({ isOpen, onClose, anchorRef, children }) {
  const popupRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleMouseDown(event) {
      if (popupRef.current?.contains(event.target)) {
        return;
      }

      if (anchorRef?.current?.contains(event.target)) {
        return;
      }

      onClose?.();
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={popupRef} className={styles.popup}>
      {children}
    </div>
  );
}
