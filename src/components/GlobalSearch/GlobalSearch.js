"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getUserDisplayLabel } from "@/utils/userFormatters";
import styles from "./GlobalSearch.module.css";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function formatResultDate(datetime) {
  const value = String(datetime || "").trim();
  if (!value) {
    return "";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export default function GlobalSearch({ onSelectUser }) {
  const inputRef = useRef(null);
  const portalContainerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [hasError, setHasError] = useState(false);
  const [portalContainer, setPortalContainer] = useState(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const node = document.createElement("div");
    node.setAttribute("data-global-search-portal", "true");
    document.body.appendChild(node);
    portalContainerRef.current = node;
    setPortalContainer(node);

    return () => {
      setPortalContainer(null);
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
      portalContainerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = String(event.key || "").toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setIsOpen(true);
        window.requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
        return;
      }

      if (key === "escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }

        const payload = await response.json();
        setResults(Array.isArray(payload?.results) ? payload.results : []);
      } catch (error) {
        if (error?.name !== "AbortError") {
          setResults([]);
          setHasError(true);
        }
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, query]);

  const closeSearch = () => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setHasError(false);
    setIsLoading(false);
    setIsInputFocused(false);
  };

  const handleSelect = (result) => {
    const userId = String(result?.userId || "").trim();
    if (!userId) {
      return;
    }

    onSelectUser?.(result, query.trim());
    closeSearch();
  };

  return (
    <div className={styles.root}>
      <button type="button" className={styles.trigger} onClick={() => setIsOpen(true)} aria-label="Open message search">
        <SearchIcon />
        <span>Search</span>
      </button>

      {isOpen &&
        portalContainer &&
        createPortal(
          <div className={styles.overlay} onClick={closeSearch}>
            <div className={styles.panel} onClick={(event) => event.stopPropagation()}>
              <div className={styles.inputWrap}>
                <SearchIcon />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder="Search messages..."
                  className={styles.input}
                />
                {!isInputFocused && query.trim().length === 0 && (
                  <span className={styles.shortcutHint}>Cmd K / Ctrl K</span>
                )}
                <button type="button" className={styles.closeButton} onClick={closeSearch} aria-label="Close search">
                  x
                </button>
              </div>

              <div className={styles.results}>
                {isLoading &&
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={`search-skeleton-${index}`} className={styles.resultSkeleton} aria-hidden="true" />
                  ))}

                {!isLoading && hasError && <p className={styles.emptyText}>Search failed. Try again.</p>}
                {!isLoading && !hasError && query.trim().length > 0 && query.trim().length < 2 && (
                  <p className={styles.emptyText}>Type at least 2 characters.</p>
                )}
                {!isLoading && !hasError && query.trim().length >= 2 && results.length === 0 && (
                  <p className={styles.emptyText}>No matching messages.</p>
                )}

                {!isLoading &&
                  !hasError &&
                  results.map((result, index) => {
                    const userId = String(result?.userId || "");
                    const displayLabel = getUserDisplayLabel({
                      username: result?.username || "",
                      user_id: userId,
                    });
                    const datetimeLabel = formatResultDate(result?.datetime);

                    return (
                      <button
                        type="button"
                        key={`${userId}-${result?.datetime || "na"}-${index}`}
                        className={styles.resultItem}
                        onClick={() => handleSelect(result)}
                      >
                        <p className={styles.resultUser}>{displayLabel}</p>
                        {datetimeLabel ? <p className={styles.resultDate}>{datetimeLabel}</p> : null}
                        <p className={styles.resultExcerpt}>{String(result?.excerpt || "").trim()}</p>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>,
          portalContainer
        )}
    </div>
  );
}
