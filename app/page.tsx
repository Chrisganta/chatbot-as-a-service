import { ChatWindow } from "@/components/ChatWindow";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.card}>
        <ChatWindow />
      </div>
    </div>
  );
}
