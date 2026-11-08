'use client';

import { CONDITION_LABELS, formatPrice } from '@hucxter/contracts';
import type { Department, UploadFailureReason } from '@hucxter/contracts';
import { UpChunk } from '@mux/upchunk';
import { Camera, Pause, Play, RotateCcw, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import {
  createDraft,
  draftStatus,
  publishListing,
  reportUpload,
  startUpload,
} from '@/app/actions/sell';
import type { PublishOutcome } from '@/app/actions/sell';
import { DetailsForm } from './details-form';
import type { DetailsValues } from './details-form';
import styles from './sell.module.css';
import { checkVideo, readDuration } from './video-check';

export type SellStep = 'video' | 'details' | 'review';
const STEPS: { key: SellStep; label: string }[] = [
  { key: 'video', label: 'Video' },
  { key: 'details', label: 'Details' },
  { key: 'review', label: 'Review' },
];

export type MediaState = 'awaiting_upload' | 'processing' | 'ready' | 'errored' | 'removed' | null;

export interface SellDraft {
  listingId: string;
  details: DetailsValues;
  media: MediaState;
  publishWhenReady: boolean;
  areaLabel: string | null;
  /** updated_at text from Postgres, never parsed: publish compares it exactly. */
  version: string;
}

type Upload =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'uploading'; percent: number; paused: boolean }
  | { phase: 'done' }
  | { phase: 'failed'; message: string; reason: UploadFailureReason };

function stepOf(value: string | null): SellStep {
  return value === 'details' || value === 'review' ? value : 'video';
}

function detailsComplete(details: DetailsValues): boolean {
  return (
    details.title.trim() !== '' &&
    details.categorySlug !== '' &&
    details.condition !== '' &&
    (details.free || details.price !== '') &&
    /^\d{5}$/.test(details.pickupZip)
  );
}

/**
 * /sell (Brief 03C.1 §3.3): one step per screen, the step in the URL (Back works), the draft in
 * the database (survives reload). The video uploads straight to Mux (or the local fake) while the
 * seller fills in details; leaving mid-upload asks first.
 */
export function SellFlow({
  draft: initialDraft,
  departments,
  homeZip,
  limits,
}: {
  draft: SellDraft | null;
  departments: Department[];
  homeZip: string;
  limits: { maxBytes: number; maxSeconds: number };
}) {
  const params = useSearchParams();
  const step =
    initialDraft === null && params.get('draft') === null ? 'video' : stepOf(params.get('step'));
  const [draft, setDraft] = useState(initialDraft);
  const [upload, setUpload] = useState<Upload>({ phase: 'idle' });
  const chunk = useRef<UpChunk | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const go = useCallback(
    (next: SellStep, listingId = draft?.listingId) => {
      if (listingId === undefined) return;
      const url = `/sell?draft=${listingId}&step=${next}`;
      window.history.pushState(null, '', url);
    },
    [draft?.listingId],
  );

  // Move focus to the step heading on every step change (screen readers announce the new step).
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const uploading = upload.phase === 'uploading' || upload.phase === 'checking';
  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [uploading]);

  const choose = async (file: File) => {
    setUpload({ phase: 'checking' });
    const check = checkVideo(file, await readDuration(file), limits);
    if (!check.ok) {
      setUpload({ phase: 'failed', message: check.message, reason: check.reason });
      if (draft !== null) {
        void reportUpload({
          name: 'upload_failed',
          listingId: draft.listingId,
          reason: check.reason,
        });
      }
      return;
    }
    let current = draft;
    if (current === null) {
      const created = await createDraft();
      if (created.status !== 'ok') {
        setUpload({ phase: 'failed', message: created.message, reason: 'server' });
        return;
      }
      current = {
        listingId: created.listingId,
        details: { ...emptyDetails, pickupZip: homeZip },
        media: null,
        publishWhenReady: false,
        areaLabel: null,
        // Set when the details step saves (review comes after it).
        version: '',
      };
      setDraft(current);
      window.history.replaceState(null, '', `/sell?draft=${created.listingId}&step=video`);
    }
    const listingId = current.listingId;
    const started = await startUpload({
      listingId,
      type: check.type,
      sizeBytes: file.size,
      durationSeconds: null,
    });
    if (started.status !== 'ok') {
      setUpload({ phase: 'failed', message: started.message, reason: 'server' });
      return;
    }
    setDraft((d) => (d === null ? d : { ...d, media: 'awaiting_upload' }));
    setUpload({ phase: 'uploading', percent: 0, paused: false });
    const task = UpChunk.createUpload({
      endpoint: started.uploadUrl,
      file,
      chunkSize: 5120,
      attempts: 5,
      delayBeforeAttempt: 2,
    });
    chunk.current = task;
    task.on('progress', (event) => {
      const percent = typeof event.detail === 'number' ? Math.round(event.detail) : 0;
      setUpload((u) => (u.phase === 'uploading' ? { ...u, percent } : u));
    });
    task.on('success', () => {
      chunk.current = null;
      setUpload({ phase: 'done' });
      setDraft((d) => (d === null ? d : { ...d, media: 'processing' }));
      void reportUpload({ name: 'upload_completed', listingId });
    });
    task.on('error', () => {
      chunk.current = null;
      setUpload({
        phase: 'failed',
        message: 'The upload stopped. Check your connection and try again.',
        reason: 'network',
      });
      void reportUpload({ name: 'upload_failed', listingId, reason: 'network' });
    });
    if (stepOf(new URLSearchParams(window.location.search).get('step')) === 'video') {
      go('details', listingId);
    }
  };

  const togglePause = () => {
    const task = chunk.current;
    if (task === null || upload.phase !== 'uploading') return;
    if (task.paused) task.resume();
    else task.pause();
    setUpload({ ...upload, paused: task.paused });
  };

  return (
    <div className={styles.flow}>
      <ol className={styles.progress} aria-label="Steps">
        {STEPS.map((s, index) => (
          <li
            key={s.key}
            data-current={s.key === step}
            data-done={STEPS.findIndex((x) => x.key === step) > index}
            aria-current={s.key === step ? 'step' : undefined}
          >
            <span className={styles.stepNumber}>{index + 1}</span> {s.label}
          </li>
        ))}
      </ol>

      {upload.phase === 'uploading' || upload.phase === 'checking' ? (
        <UploadBar upload={upload} onTogglePause={togglePause} />
      ) : null}

      {step === 'video' ? (
        <section className={styles.step} aria-labelledby="sell-step">
          <h1 id="sell-step" ref={headingRef} tabIndex={-1} className={styles.title}>
            Add a video
          </h1>
          <p className={styles.lede}>
            Show the item from every side, up to {limits.maxSeconds} seconds. Avoid faces, house
            numbers and anything that shows where you live.
          </p>
          <VideoPicker
            onFile={(file) => {
              void choose(file);
            }}
            disabled={uploading}
            media={draft?.media ?? null}
          />
          {upload.phase === 'failed' ? (
            <p role="alert" className={styles.error}>
              {upload.message}
            </p>
          ) : null}
          {draft !== null && draft.media !== null && draft.media !== 'errored' && !uploading ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  go('details');
                }}
              >
                Continue
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'details' && draft !== null ? (
        <section className={styles.step} aria-labelledby="sell-step">
          <h1 id="sell-step" ref={headingRef} tabIndex={-1} className={styles.title}>
            Describe it
          </h1>
          <DetailsForm
            listingId={draft.listingId}
            departments={departments}
            initial={draft.details}
            submitLabel="Continue"
            onSaved={(details, { version }) => {
              setDraft((d) => (d === null ? d : { ...d, details, version }));
              go('review');
            }}
          />
        </section>
      ) : null}

      {step === 'review' && draft !== null ? (
        <ReviewStep
          headingRef={headingRef}
          draft={draft}
          departments={departments}
          uploading={uploading}
          onMedia={(media) => {
            setDraft((d) => (d === null ? d : { ...d, media }));
          }}
          onEditVideo={() => {
            go('video');
          }}
          onEditDetails={() => {
            go('details');
          }}
        />
      ) : null}
    </div>
  );
}

const emptyDetails: DetailsValues = {
  title: '',
  departmentSlug: '',
  categorySlug: '',
  condition: '',
  free: false,
  price: '',
  attributes: {},
  description: '',
  pickupZip: '',
};

function UploadBar({ upload, onTogglePause }: { upload: Upload; onTogglePause: () => void }) {
  const percent = upload.phase === 'uploading' ? upload.percent : 0;
  const paused = upload.phase === 'uploading' && upload.paused;
  return (
    <div className={styles.uploadBar}>
      <div className={styles.uploadText}>
        <span>
          {upload.phase === 'checking'
            ? 'Checking your video…'
            : paused
              ? `Upload paused at ${String(percent)}%`
              : `Uploading video… ${String(percent)}%`}
        </span>
        {upload.phase === 'uploading' ? (
          <button type="button" className={styles.iconButton} onClick={onTogglePause}>
            {paused ? (
              <Play size={16} aria-hidden="true" />
            ) : (
              <Pause size={16} aria-hidden="true" />
            )}
            {paused ? 'Resume' : 'Pause'}
          </button>
        ) : null}
      </div>
      <progress className={styles.meter} max={100} value={percent} aria-label="Upload progress" />
    </div>
  );
}

function VideoPicker({
  onFile,
  disabled,
  media,
}: {
  onFile: (file: File) => void;
  disabled: boolean;
  media: MediaState;
}) {
  const recordId = useId();
  const chooseId = useId();
  const [dragging, setDragging] = useState(false);
  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file !== undefined) onFile(file);
  };
  return (
    <div
      className={styles.dropZone}
      data-dragging={dragging}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => {
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) pick(event.dataTransfer.files);
      }}
    >
      {media === 'processing' || media === 'ready' ? (
        <p className={styles.mediaNote}>
          {media === 'ready' ? 'Your video is ready.' : 'Your video is uploaded and processing.'}{' '}
          You can replace it below.
        </p>
      ) : media === 'awaiting_upload' && !disabled ? (
        <p className={styles.mediaNote}>Your last upload didn’t finish. Choose the video again.</p>
      ) : media === 'errored' ? (
        <p className={styles.mediaNote}>We couldn’t use that video. Choose another one.</p>
      ) : null}
      <div className={styles.pickers}>
        <label htmlFor={recordId} className={styles.pickButton} data-disabled={disabled}>
          <Camera size={20} aria-hidden="true" /> Record a video
        </label>
        <input
          id={recordId}
          className={styles.fileInput}
          type="file"
          accept="video/*"
          capture="environment"
          disabled={disabled}
          onChange={(event) => {
            pick(event.target.files);
            event.target.value = '';
          }}
        />
        <label htmlFor={chooseId} className={styles.pickButtonSecondary} data-disabled={disabled}>
          <Upload size={20} aria-hidden="true" /> Choose a video
        </label>
        <input
          id={chooseId}
          className={styles.fileInput}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          disabled={disabled}
          data-testid="choose-video"
          onChange={(event) => {
            pick(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
      <p className={styles.hint}>MP4, MOV or WebM. You can also drop a file here.</p>
    </div>
  );
}

const CHANGED_MESSAGE =
  'This listing changed since you opened it. Check the details, then publish.';

function ReviewStep({
  headingRef,
  draft,
  departments,
  uploading,
  onMedia,
  onEditVideo,
  onEditDetails,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  draft: SellDraft;
  departments: Department[];
  uploading: boolean;
  onMedia: (media: MediaState) => void;
  onEditVideo: () => void;
  onEditDetails: () => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PublishOutcome | null>(
    draft.publishWhenReady ? 'scheduled' : null,
  );
  const [error, setError] = useState<string | null>(
    params.get('changed') === '1' ? CHANGED_MESSAGE : null,
  );
  const { details, media, listingId, version } = draft;
  const complete = detailsComplete(details);

  // Poll while the video is on its way or processing.
  useEffect(() => {
    if (media === 'ready' || media === 'errored' || media === 'removed') return;
    const timer = window.setInterval(() => {
      void draftStatus({ listingId }).then((status) => {
        if (status.status !== 'ok') return;
        if (status.media !== media) onMedia(status.media);
        if (status.listingStatus !== 'draft') {
          router.push(`/l/${listingId}`);
        }
      });
    }, 3000);
    return () => {
      window.clearInterval(timer);
    };
  }, [listingId, media, onMedia, router]);

  const publish = (whenReady: boolean) => {
    setError(null);
    startTransition(async () => {
      const outcome = await publishListing({ listingId, whenReady, version });
      if (outcome.status !== 'ok') {
        setError(outcome.message);
        return;
      }
      if (outcome.outcome === 'changed') {
        // Edited elsewhere since this page loaded: the page renders the saved draft again (its
        // key changes with ?changed=1, so the flow remounts with it) and says so.
        router.replace(`/sell?draft=${listingId}&step=review&changed=1`);
        return;
      }
      setResult(outcome.outcome);
      if (outcome.outcome === 'published' || outcome.outcome === 'in_review') {
        router.push(`/l/${listingId}`);
      }
      if (outcome.outcome === 'not_ready') setError('Your video isn’t ready yet.');
    });
  };

  const department = departments.find((d) => d.slug === details.departmentSlug);
  const subcategory = department?.subcategories.find((s) => s.slug === details.categorySlug);
  const price = details.free ? 0 : Number(details.price) * 100;
  const processing = media === 'awaiting_upload' || media === 'processing';

  return (
    <section className={styles.step} aria-labelledby="sell-step">
      <h1 id="sell-step" ref={headingRef} tabIndex={-1} className={styles.title}>
        Review and publish
      </h1>
      <div className={styles.preview}>
        <div className={styles.previewPoster} aria-hidden="true">
          {media === 'ready' ? 'Video ready' : processing ? 'Processing video…' : 'No video yet'}
        </div>
        <div className={styles.previewBody}>
          <p className={styles.previewPrice}>{complete ? formatPrice(price) : '—'}</p>
          <p className={styles.previewTitle}>{details.title || 'Untitled'}</p>
          <p className={styles.hint}>
            {details.condition === '' ? 'Condition not set' : CONDITION_LABELS[details.condition]}
            {subcategory === undefined ? '' : ` · ${subcategory.name}`}
            {draft.areaLabel === null ? '' : ` · ${draft.areaLabel}`}
          </p>
        </div>
      </div>
      <div className={styles.row}>
        <button type="button" className={styles.textButton} onClick={onEditVideo}>
          <RotateCcw size={16} aria-hidden="true" /> Change video
        </button>
        <button type="button" className={styles.textButton} onClick={onEditDetails}>
          Edit details
        </button>
      </div>
      <p className={styles.safety}>
        <strong>Meet in a public place.</strong> Never share your address. Buyers see only your area
        and a distance range.
      </p>

      <p className={styles.status} role="status">
        {media === 'ready'
          ? 'Your video is ready.'
          : media === 'errored'
            ? 'We couldn’t use that video. Change the video to continue.'
            : uploading
              ? 'Your video is still uploading. Keep this page open.'
              : media === 'awaiting_upload'
                ? 'Your upload didn’t finish. Change the video to continue.'
                : media === 'processing'
                  ? 'Your video is processing. This usually takes under a minute.'
                  : 'Add a video to publish.'}
      </p>
      {!complete ? (
        <p className={styles.error}>Add the missing details before publishing.</p>
      ) : null}
      {result === 'scheduled' ? (
        <p className={styles.notice} role="status">
          We’ll publish it as soon as the video is ready. You can leave this page.{' '}
          <Link href="/profile">Go to your listings</Link>
        </p>
      ) : null}
      <p role="alert" className={styles.error}>
        {error}
      </p>
      <div className={styles.actions}>
        {media === 'ready' ? (
          <button
            type="button"
            className={styles.primary}
            disabled={pending || !complete}
            onClick={() => {
              publish(false);
            }}
          >
            {pending ? 'Publishing…' : 'Publish'}
          </button>
        ) : (
          <button
            type="button"
            className={styles.primary}
            disabled={pending || !complete || !(processing || uploading) || result === 'scheduled'}
            onClick={() => {
              publish(true);
            }}
          >
            {result === 'scheduled' ? 'Will publish when ready' : 'Publish when ready'}
          </button>
        )}
        <Link href="/profile?filter=drafts" className={styles.secondary}>
          Save draft
        </Link>
      </div>
    </section>
  );
}
