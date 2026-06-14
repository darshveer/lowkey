import { useRef, useState } from 'react';
import './PhotoGrid.css';

/**
 * PhotoGrid — Film-roll style horizontal scrolling photo grid
 *
 * @param {Object} props
 * @param {{ id: string, photo_url: string, uploaded_by?: string, caption?: string, created_at?: string, filter?: string }[]} props.photos
 * @param {(file: File) => void} [props.onUpload] - Called with selected file
 * @param {boolean} [props.isLocked=false] - If true, shows locked state
 * @param {string} [props.timeRemaining] - Time left until photos are deleted
 */
export default function PhotoGrid({ photos = [], onUpload, isLocked = false, timeRemaining }) {
  const fileInputRef = useRef(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
    // Reset so the same file can be re-selected
    if (e.target) e.target.value = '';
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleDownload = (e, photo) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = photo.photo_url;
    link.download = `lowkey-photo-${photo.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <>
      <div className="photo-grid">
        {timeRemaining && (
          <div className="photo-grid-timer-banner">
            <span className="timer-icon">⏳</span>
            Photos will be auto-deleted in: <strong>{timeRemaining}</strong>
          </div>
        )}

        <div className="photo-grid__scroll">
          {photos.map((photo) => (
            <div key={photo.id} className="photo-grid__frame" onClick={() => setSelectedPhoto(photo)}>
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
                {photo.uploaded_by && (
                  <span className="photo-grid__uploader">by {photo.uploaded_by}</span>
                )}
                <span className="photo-grid__timestamp">
                  {formatTimestamp(photo.created_at)}
                </span>
                <button 
                  className="photo-grid__download-btn" 
                  onClick={(e) => handleDownload(e, photo)}
                  title="Download Image"
                  type="button"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}

          {onUpload && (
            <div className="photo-grid__upload" onClick={handleUploadClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleUploadClick()}>
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

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div className="lightbox-overlay" onClick={() => setSelectedPhoto(null)}>
          <button className="lightbox-close" onClick={() => setSelectedPhoto(null)} aria-label="Close" type="button">✕</button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img 
              src={selectedPhoto.photo_url} 
              alt="Full size view" 
              className="lightbox-image" 
              style={selectedPhoto.filter ? { filter: selectedPhoto.filter } : undefined}
            />
            <div className="lightbox-footer">
              <div className="lightbox-info">
                {selectedPhoto.uploaded_by && <span>Uploaded by <strong>{selectedPhoto.uploaded_by}</strong></span>}
                <span className="lightbox-time">{formatTimestamp(selectedPhoto.created_at)}</span>
              </div>
              <button className="lightbox-download-btn" onClick={(e) => handleDownload(e, selectedPhoto)} type="button">
                Download Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
