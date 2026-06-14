import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { updateUserProfile } from '../utils/storage';
import { getInitials, getAvatarGradient } from '../utils/helpers';
import './Navbar.css';

/**
 * Global floating navigation bar for LowKey.
 * Persistent across all pages.
 */
export default function Navbar({
  currentUser,
  activeTab,
  setActiveTab,
  setLoginRedirect,
  onLogout,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Close profile menu if clicked outside
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (!e.target.closest('.navbar-profile-wrap')) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const handleTabClick = (tab) => {
    if (location.pathname === '/') {
      if (tab === 'create') {
        if (currentUser) {
          navigate('/create');
        } else {
          setLoginRedirect(true);
          setActiveTab('login');
        }
      } else {
        setActiveTab(tab);
      }
    } else {
      if (tab === 'create') {
        if (currentUser) {
          navigate('/create');
        } else {
          navigate('/', { state: { tab: 'login', redirect: true } });
        }
      } else {
        navigate('/', { state: { tab } });
      }
    }
  };

  const handleLogoClick = () => {
    if (location.pathname === '/') {
      setActiveTab('discover');
    } else {
      navigate('/', { state: { tab: 'discover' } });
    }
  };

  const handleAuthClick = () => {
    if (currentUser) {
      onLogout();
      if (location.pathname !== '/') {
        navigate('/');
      }
    } else {
      if (location.pathname === '/') {
        setLoginRedirect(false);
        setActiveTab('login');
      } else {
        navigate('/', { state: { tab: 'login', redirect: false } });
      }
    }
  };

  const getIsActive = (tab) => {
    if (location.pathname === '/create') {
      return tab === 'create';
    }
    if (location.pathname === '/') {
      return activeTab === tab;
    }
    return false;
  };

  const handleProfileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        updateUserProfile(currentUser.id, { profile_pic_b64: base64String });
        // Dispatch custom event to let App.jsx reload user session
        window.dispatchEvent(new CustomEvent('lowkey_db_sync'));
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = ''; // Reset input
  };

  return (
    <nav className="global-navbar" aria-label="Main navigation">
      <div className="navbar-content">
        {/* Left Logo */}
        <div className="navbar-logo" onClick={handleLogoClick}>
          <span className="brand-cursive text-gradient">lowkey</span>
        </div>

        {/* Center Tabs */}
        <div className="navbar-tabs">
          <button
            className={`navbar-tab ${getIsActive('discover') ? 'navbar-tab--active' : ''}`}
            onClick={() => handleTabClick('discover')}
            type="button"
          >
            Discover
          </button>
          <button
            className={`navbar-tab ${getIsActive('create') ? 'navbar-tab--active' : ''}`}
            onClick={() => handleTabClick('create')}
            type="button"
          >
            Create Party
          </button>
          {currentUser && (
            <>
              <button
                className={`navbar-tab ${getIsActive('my-parties') ? 'navbar-tab--active' : ''}`}
                onClick={() => handleTabClick('my-parties')}
                type="button"
              >
                Hosted
              </button>
              <button
                className={`navbar-tab ${getIsActive('rsvps') ? 'navbar-tab--active' : ''}`}
                onClick={() => handleTabClick('rsvps')}
                type="button"
              >
                RSVPs
              </button>
            </>
          )}
        </div>

        {/* Right Auth Action */}
        <div className="navbar-auth">
          {currentUser ? (
            <div className="navbar-profile-wrap">
              <button 
                className="navbar-profile-btn" 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                type="button"
              >
                {currentUser.profile_pic_b64 ? (
                  <img src={currentUser.profile_pic_b64} alt={currentUser.name} className="navbar-profile-pic" />
                ) : (
                  <div className="navbar-profile-avatar" style={{ background: getAvatarGradient(currentUser.name) }}>
                    {getInitials(currentUser.name)}
                  </div>
                )}
              </button>

              {showProfileMenu && (
                <div className="navbar-profile-dropdown">
                  <div className="dropdown-header">
                    <p className="dropdown-name">{currentUser.name}</p>
                    <p className="dropdown-username">@{currentUser.username}</p>
                  </div>
                  <div className="dropdown-actions">
                    <button className="dropdown-action-btn" onClick={() => fileInputRef.current?.click()}>
                      Upload Picture
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      accept="image/*"
                      onChange={handleProfileUpload}
                    />
                    <button className="dropdown-action-btn dropdown-action-btn--logout" onClick={handleAuthClick}>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              className={`navbar-auth-btn navbar-auth-btn--login ${getIsActive('login') ? 'navbar-auth-btn--active' : ''}`}
              onClick={handleAuthClick}
              type="button"
            >
              Log In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
