import { useState } from 'react';
import { completeProfile, isProfileIncomplete, logoutUser } from '../utils/storage';
import { digitsOnly, isTenDigitPhone } from '../utils/helpers';
import { useTransition } from '../hooks/useTransition';
import './ProfileCompletionModal.css';

/**
 * ProfileCompletionModal — shown app-wide when a signed-in profile is missing
 * the username / birthdate that Google OAuth doesn't provide. It blocks the app
 * (no backdrop/Escape dismiss) until the profile is completed, because birthdate
 * powers the 21+ alcohol age gate and usernames must be unique. A "Sign out"
 * escape hatch keeps the user from being trapped.
 *
 * @param {Object} props
 * @param {Object|null} props.currentUser
 * @param {(user: Object|null) => void} props.setCurrentUser
 */
export default function ProfileCompletionModal({ currentUser, setCurrentUser }) {
  const [username, setUsername] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { playTransition } = useTransition();

  // Only render for a signed-in user whose profile still lacks username/birthdate.
  if (!isProfileIncomplete(currentUser)) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !birthdate) {
      setError('Please choose a username and enter your date of birth.');
      return;
    }
    if (phone && !isTenDigitPhone(phone)) {
      setError('Please enter a valid 10-digit phone number (or leave it blank).');
      return;
    }
    setSubmitting(true);
    // Curtain covers the modal, the profile is saved, then it splits apart onto the
    // now-complete app. (The modal unmounts when the profile becomes complete.)
    let res;
    await playTransition(async () => {
      res = await completeProfile(currentUser.id, { username, birthdate, phone });
      if (res.success) setCurrentUser(res.user);
    });
    if (!res || !res.success) {
      setError(res ? res.error : 'Something went wrong — please try again.');
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await logoutUser();
    setCurrentUser(null);
  };

  return (
    <div className="profile-complete-overlay" role="dialog" aria-modal="true" aria-label="Finish setting up your profile">
      {/* No backdrop onClick — this step is required, not dismissable. */}
      <div className="profile-complete-backdrop" />
      <div className="profile-complete-dialog animate-scale-in">
        <h3 className="profile-complete__title">One more step</h3>
        <p className="profile-complete__subtitle">
          Welcome{currentUser.name ? `, ${currentUser.name.split(' ')[0]}` : ''}! Pick a username and
          confirm your date of birth to finish setting up your LowKey profile.
        </p>

        {error && <div className="profile-complete__error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} className="profile-complete__form">
          <div className="profile-complete__field">
            <label htmlFor="complete-username">Username *</label>
            <input
              id="complete-username"
              type="text"
              required
              placeholder="arjun"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="profile-complete__field">
            <label htmlFor="complete-dob">Date of Birth * (Age verification)</label>
            <input
              id="complete-dob"
              type="date"
              required
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
            />
            <small className="profile-complete__help">Used to verify access for parties with alcohol (21+).</small>
          </div>
          <div className="profile-complete__field">
            <label htmlFor="complete-phone">Phone Number (optional)</label>
            <input
              id="complete-phone"
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(digitsOnly(e.target.value).slice(0, 10))}
              autoComplete="tel"
              maxLength={10}
            />
          </div>
          <button type="submit" className="profile-complete__submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Finish setup'}
          </button>
        </form>

        <button type="button" className="profile-complete__signout" onClick={handleSignOut}>
          Sign out instead
        </button>
      </div>
    </div>
  );
}
