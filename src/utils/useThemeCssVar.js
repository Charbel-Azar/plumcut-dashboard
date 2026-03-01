"use client";

import { useEffect, useState } from "react";

export function useThemeCssVar(variableName, fallback) {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    const root = document.documentElement;

    const syncValue = () => {
      const cssValue = getComputedStyle(root).getPropertyValue(variableName).trim();
      setValue(cssValue || fallback);
    };

    syncValue();

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "data-theme")) {
        syncValue();
      }
    });

    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [fallback, variableName]);

  return value;
}
