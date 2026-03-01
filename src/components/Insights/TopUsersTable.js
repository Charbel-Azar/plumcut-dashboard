"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getUserDisplayLabel } from "@/utils/userFormatters";
import styles from "./TopUsersTable.module.css";

export default function TopUsersTable({ users }) {
  const [sortDirection, setSortDirection] = useState("desc");

  const sortedUsers = useMemo(() => {
    const source = Array.isArray(users) ? [...users] : [];
    source.sort((a, b) => {
      const aCount = Number(a?.messageCount) || 0;
      const bCount = Number(b?.messageCount) || 0;
      return sortDirection === "desc" ? bCount - aCount : aCount - bCount;
    });
    return source;
  }, [users, sortDirection]);

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Top Users</h2>
        <button
          type="button"
          className={styles.sortButton}
          onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
        >
          Sort: {sortDirection === "desc" ? "High to low" : "Low to high"}
        </button>
      </div>

      {sortedUsers.length === 0 ? (
        <p className={styles.empty}>No user activity found.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Session</th>
                <th>Messages</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user, index) => {
                const sessionId = String(user?.sessionId || "");
                const displayLabel = getUserDisplayLabel({
                  username: user?.username || "",
                  user_id: sessionId,
                });

                return (
                  <tr key={sessionId || `row-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      <Link href={`/chats?userId=${encodeURIComponent(sessionId)}`} className={styles.userLink}>
                        {displayLabel}
                      </Link>
                    </td>
                    <td className={styles.session}>{sessionId}</td>
                    <td>{Number(user?.messageCount) || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
