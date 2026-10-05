import { useRef, useState } from 'react';
import { compressImage, formatBytes } from '../lib/image';

/**
 * Site photo attachment.
 *
 * `capture="environment"` opens the rear camera straight away on a phone,
 * saving the supervisor a trip through the gallery. Each photo is compressed
 * before it is held, and the saving is shown so the user can see why it is
 * worth waiting a moment.
 */
export default function PhotoPicker({ photos, onChange, max = 5 }) {
  const inputRef = useRef(null);
  const [working, setWorking] = useState(false);

  async function handleFiles(event) {
    const chosen = Array.from(event.target.files || []);
    if (chosen.length === 0) return;

    setWorking(true);
    try {
      const room = max - photos.length;
      const compressed = await Promise.all(
        chosen.slice(0, room).map(async (file) => ({
          file: await compressImage(file),
          originalSize: file.size,
        }))
      );
      onChange([...photos, ...compressed]);
    } finally {
      setWorking(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      {photos.map((p, i) => (
        <div className="photo-row" key={i}>
          <span className="photo-name">{p.file.name}</span>
          <span className="muted small">
            {formatBytes(p.file.size)}
            {p.originalSize > p.file.size && ` (was ${formatBytes(p.originalSize)})`}
          </span>
          <button
            type="button"
            className="remove"
            onClick={() => onChange(photos.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={handleFiles}
      />

      <button
        type="button"
        className="secondary"
        disabled={working || photos.length >= max}
        onClick={() => inputRef.current?.click()}
      >
        {working
          ? 'Preparing photo…'
          : photos.length >= max
            ? `Maximum ${max} photos`
            : 'Add photo'}
      </button>
    </div>
  );
}
