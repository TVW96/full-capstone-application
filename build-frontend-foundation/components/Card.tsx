import React from 'react';
import Image from 'next/image';
import styles from './Card.module.css';

type CardProps = {
  title: string
  description: string
  imageUrl: string
}

function Card({ title, description, imageUrl }: CardProps ) {
  return (
    <div className={styles.card}>
        <header className={styles.cardHeader}>
            <h2>{title}</h2>
        </header>
        <section className={styles.cardBody}>
            <p>{description}</p>
            <div className={styles.cardImage}>
                <Image
                  src={imageUrl}
                  width={400}
                  height={300}
                  alt={title}
                />
            </div>
        </section>
    </div>
  )
}

export default Card