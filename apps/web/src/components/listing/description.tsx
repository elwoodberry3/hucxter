'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import styles from './template.module.css';

/** Plain text with line breaks kept, no auto-linking; "Show more" past about 8 lines. */
export function ListingDescription({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element !== null) setOverflows(element.scrollHeight > element.clientHeight + 1);
  }, [text]);

  return (
    <>
      <p ref={ref} id="listing-description" className={styles.description} data-expanded={expanded}>
        {text}
      </p>
      {overflows || expanded ? (
        <button
          type="button"
          className={styles.textButton}
          aria-expanded={expanded}
          aria-controls="listing-description"
          onClick={() => {
            setExpanded(!expanded);
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </>
  );
}
