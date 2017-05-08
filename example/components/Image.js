import React from 'react';
import styles from './image.css';

export default props => <img className={styles.image} src={props.src} alt={props.alt} />;
