
import React from 'react';
import styles from './Grid.module.css';

function Grid({List}: {List: React.ReactNode[]}) {
  return (
    <div className={styles.grid}>
      {List.map((item, index) => (
        <div className={styles.gridItem} key={index}>
          {item}
        </div>
      ))}
    </div>
  )
}
export default Grid
