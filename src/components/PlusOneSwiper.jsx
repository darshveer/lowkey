import React, { useState, useCallback } from 'react';
import './PlusOneSwiper.css';

/**
 * PlusOneSwiper — Tinder-style swipe card for approving/denying +1 requests
 *
 * @param {Object} props
 * @param {{ id: string, guest_name: string, plus_one_name: string }[]} props.requests
 * @param {(id: string) => void} props.onApprove
 * @param {(id: string) => void} props.onDeny
 */
export default function PlusOneSwiper({ requests = [], onApprove, onDeny }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState(null); // 'left' | 'right'

  const current = requests[currentIndex];

  const handleAction = useCallback(
    (direction) => {
      if (!current || exitDirection) return;
      setExitDirection(direction);

      // Wait for animation to finish before advancing
      setTimeout(() => {
        if (direction === 'right') {
          onApprove?.(current.id);
        } else {
          onDeny?.(current.id);
        }
        setCurrentIndex((prev) => prev + 1);
        setExitDirection(null);
      }, 350);
    },
    [current, exitDirection, onApprove, onDeny]
  );

  if (!current || currentIndex >= requests.length) {
    return (
      <div className="plus-one-swiper">
        <div className="plus-one-swiper__empty">
          <span className="plus-one-swiper__empty-icon">✨</span>
          <span className="plus-one-swiper__empty-text">No pending requests</span>
        </div>
      </div>
    );
  }

  const cardClass = [
    'plus-one-swiper__card',
    exitDirection === 'left' && 'plus-one-swiper__card--exit-left',
    exitDirection === 'right' && 'plus-one-swiper__card--exit-right',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="plus-one-swiper">
      <div className={cardClass} key={current.id}>
        <div className="plus-one-swiper__info">
          <span className="plus-one-swiper__guest-name">{current.guest_name}</span>
          <span className="plus-one-swiper__plus-label">wants to bring</span>
          <span className="plus-one-swiper__plus-name">{current.plus_one_name}</span>
        </div>

        <div className="plus-one-swiper__actions">
          <button
            className="plus-one-swiper__btn plus-one-swiper__btn--deny"
            onClick={() => handleAction('left')}
            aria-label="Deny"
            type="button"
          >
            ✗
          </button>
          <button
            className="plus-one-swiper__btn plus-one-swiper__btn--approve"
            onClick={() => handleAction('right')}
            aria-label="Approve"
            type="button"
          >
            ✓
          </button>
        </div>
      </div>

      <div className="plus-one-swiper__counter">
        {currentIndex + 1} / {requests.length}
      </div>
    </div>
  );
}
