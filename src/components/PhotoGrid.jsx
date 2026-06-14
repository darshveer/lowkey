import { useRef } from 'react';
import './PhotoGrid.css';

/**
 * PhotoGrid — Film-roll style horizontal scrolling photo grid
 *
 * @param {Object} props
 * @param {{ id: string, photo_url: string, uploaded_by?: string, caption?: string, created_at?: string, filter?: string }[]} props.photos
 * @param {(file: File) => void} [props.onUpload] - Called with selected file
 * @param {boolean} [props.isLocked=false] - If true, shows locked state
 */
export default function PhotoGrid({ photos = [], onUpload, isLocked = false }) {
  const fileInputRef = useRef(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (isLocked) {
    return (
      <div className="photo-grid">
        <div className="photo-grid__locked">
          <span className="photo-grid__locked-icon">📸</span>
          <span className="photo-grid__locked-text">Unlocks at 2 AM</span>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-grid">
      <div className="photo-grid__scroll">
        {photos.map((photo) => (
          <div key={photo.id} className="photo-grid__frame">
            <img
              className="photo-grid__image"
              src={photo.photo_url}
              alt={photo.caption || `Photo by ${photo.uploaded_by || 'guest'}`}
              loading="lazy"
              style={photo.filter ? { filter: photo.filter } : undefined}
            />
            <div className="photo-grid__meta">
              {photo.caption && (
                <span className="photo-grid__caption">{photo.caption}</span>
              )}
              <span className="photo-grid__timestamp">
                {formatTimestamp(photo.created_at)}
              </span>
            </div>
          </div>
        ))}

        {onUpload && (
          <div className="photo-grid__upload" onClick={handleUploadClick} role="button" tabIndex={0}>
            <span className="photo-grid__upload-icon">+</span>
            <span className="photo-grid__upload-text">Add Photo</span>
            <input
              ref={fileInputRef}
              className="photo-grid__upload-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
