import Link from "next/link";
import Footer from "./Footer";
import styles from "./EditorialPage.module.css";

type EditorialSection = { number: string; title: string; body: string; points?: string[] };

export default function EditorialPage({ eyebrow, title, intro, note, sections, cta }: { eyebrow: string; title: string; intro: string; note?: string; sections: EditorialSection[]; cta?: { label: string; href: string; text: string } }) {
  return <>
    <main className={styles.main} id="main-content">
      <header className={styles.hero}><div><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1></div><p className={styles.intro}>{intro}</p></header>
      {note && <aside className={styles.note}><span aria-hidden="true">読</span><p>{note}</p></aside>}
      <div className={styles.sections}>{sections.map((section) => <section key={section.number}>
        <p className={styles.number}>{section.number}</p><div><h2>{section.title}</h2><p>{section.body}</p>{section.points && <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}</div>
      </section>)}</div>
      {cta && <section className={styles.cta}><div><p>Next on your reading list</p><h2>{cta.text}</h2></div><Link href={cta.href}>{cta.label}<span aria-hidden="true">→</span></Link></section>}
    </main><Footer />
  </>;
}
