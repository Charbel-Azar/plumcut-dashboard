import Sidebar from "@/components/Sidebar/Sidebar";
import styles from "./chats.module.css";
import skeleton from "./chats-skeleton.module.css";

const ROW_COUNT = 8;

export default function ChatsLoading() {
  return (
    <div className={styles.page}>
      <Sidebar />

      <main className={styles.content} aria-busy="true" aria-live="polite">
        <section className={`${styles.column} ${styles.listColumn}`}>
          <div className={skeleton.searchBarSkeleton} />
          {Array.from({ length: ROW_COUNT }).map((_, index) => (
            <div className={skeleton.userRowSkeleton} key={index}>
              <div className={skeleton.avatarSkeleton} />
              <div className={skeleton.userText}>
                <div className={skeleton.lineSkeleton} />
                <div className={`${skeleton.lineSkeleton} ${skeleton.lineShort}`} />
              </div>
            </div>
          ))}
        </section>

        <section className={`${styles.column} ${styles.chatColumn}`}>
          <div className={skeleton.chatSkeleton} />
        </section>

        <section className={`${styles.column} ${styles.infoColumn}`}>
          <div className={skeleton.infoSkeleton} />
        </section>
      </main>
    </div>
  );
}
