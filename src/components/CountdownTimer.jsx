import { useState, useEffect } from 'react';
import { getCountdown } from '../utils/helpers.js';
import './CountdownTimer.css';

/**
 * CountdownTimer — Large countdown display with glassmorphism digit boxes
 *
 * @param {Object} props
 * @param {string} props.targetDate - Target date in YYYY-MM-DD format
 * @param {string} props.targetTime - Target time in HH:mm format
 * @param {boolean} [props.isOver] - The party has ended (end time passed)
 */
export default function CountdownTimer({ targetDate, targetTime, isOver = false }) {
  const [countdown, setCountdown] = useState(() => getCountdown(targetDate, targetTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getCountdown(targetDate, targetTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, targetTime]);

  const pad = (n) => String(n).padStart(2, '0');

  // Party is over: end time has passed.
  if (isOver) {
    return (
      <div className="countdown-timer">
        <div className="countdown-timer__done countdown-timer__done--over">
          <span className="countdown-timer__done-text">That's a wrap</span>
        </div>
      </div>
    );
  }

  // Start time reached (and not yet over): the party is happening now.
  if (countdown.isPast) {
    return (
      <div className="countdown-timer">
        <div className="countdown-timer__done">
          <span className="countdown-timer__done-text">The party is live</span>
        </div>
      </div>
    );
  }

  return (
    <div className="countdown-timer">
      <div className="countdown-timer__digits">
        <div className="countdown-timer__box">
          <span className="countdown-timer__value">{pad(countdown.days)}</span>
          <span className="countdown-timer__unit">Days</span>
        </div>

        <span className="countdown-timer__sep">:</span>

        <div className="countdown-timer__box">
          <span className="countdown-timer__value">{pad(countdown.hours)}</span>
          <span className="countdown-timer__unit">Hrs</span>
        </div>

        <span className="countdown-timer__sep">:</span>

        <div className="countdown-timer__box">
          <span className="countdown-timer__value">{pad(countdown.minutes)}</span>
          <span className="countdown-timer__unit">Min</span>
        </div>

        <span className="countdown-timer__sep">:</span>

        <div className="countdown-timer__box">
          <span className="countdown-timer__value">{pad(countdown.seconds)}</span>
          <span className="countdown-timer__unit">Sec</span>
        </div>
      </div>
    </div>
  );
}
