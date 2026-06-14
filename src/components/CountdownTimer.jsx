import { useState, useEffect } from 'react';
import { getCountdown } from '../utils/helpers.js';
import './CountdownTimer.css';

/**
 * CountdownTimer — Large countdown display with glassmorphism digit boxes
 *
 * @param {Object} props
 * @param {string} props.targetDate - Target date in YYYY-MM-DD format
 * @param {string} props.targetTime - Target time in HH:mm format
 */
export default function CountdownTimer({ targetDate, targetTime }) {
  const [countdown, setCountdown] = useState(() => getCountdown(targetDate, targetTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getCountdown(targetDate, targetTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, targetTime]);

  const pad = (n) => String(n).padStart(2, '0');

  if (countdown.isPast) {
    return (
      <div className="countdown-timer">
        <div className="countdown-timer__done">
          <span className="countdown-timer__done-text">🔥 IT'S TIME</span>
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
