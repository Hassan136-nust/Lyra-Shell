import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppContext } from '../contexts/AppContext';

/* ── Inline SVG Icons ─────────────────────────────────────────── */
const FingerprintIcon = ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <path d="M12 10a2 2 0 0 1 2 2c0 1.02-.1 2.51-.26 4" />
        <path d="M14 13.12c0 2.38-.16 6.88-1.5 9.88" />
        <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02a11.02 11.02 0 0 0-1.79-8" />
        <path d="M2 12a10 10 0 0 1 18-6" />
        <path d="M2 16c.5-1.5 1.17-3.5 4-5.5" />
        <path d="M21.8 16c-.12-.76-.38-2.38-.76-3.5A9.99 9.99 0 0 0 12 4" />
        <path d="M7 20.7a9.96 9.96 0 0 1-2.73-5.7" />
        <path d="M9.5 14.6c0 1.87-.15 4.65-1 7.4" />
    </svg>
);

const LockKeyIcon = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <circle cx="12" cy="16" r="1" />
        <path d="M12 17v2" />
    </svg>
);

const ArrowRightIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
    </svg>
);

const BatteryIcon = ({ level, charging }) => (
    <svg width="20" height="12" viewBox="0 0 28 16" fill="none">
        <rect x="1" y="1" width="22" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="3" width={Math.max(1, (level / 100) * 18)} height="10" rx="1"
            fill={level > 20 ? 'currentColor' : 'var(--ctp-red)'} />
        <rect x="23" y="5" width="3" height="6" rx="1.5" fill="currentColor" />
        {charging && <text x="10" y="13" fontSize="11" fill="var(--ctp-green)" textAnchor="middle" style={{ fontWeight: 'bold' }}>⚡</text>}
    </svg>
);

const ShutdownIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
    </svg>
);

const SleepIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);

const RestartIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
);

/* ── Particle Background ──────────────────────────────────────── */
const PARTICLE_COUNT = 150;

const createParticles = () =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 20 + 15,
        delay: Math.random() * 10,
        opacity: Math.random() * 0.4 + 0.1,
    }));

/* ── Lock Screen Component ────────────────────────────────────── */
const LockScreen = ({ isLocked, onUnlock, biometricAvailable }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('User');
    const [biometricChecking, setBiometricChecking] = useState(false);
    const [showPasswordMode, setShowPasswordMode] = useState(false);
    const [time, setTime] = useState(new Date());
    const [unlocking, setUnlocking] = useState(false);
    const [shakeKey, setShakeKey] = useState(0);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [batteryLevel, setBatteryLevel] = useState(100);
    const [isCharging, setIsCharging] = useState(false);
    const [showPowerMenu, setShowPowerMenu] = useState(false);
    const { runAction } = useAppContext();
    const powerMenuRef = useRef(null);

    const handleMouseMove = (e) => {
        setMousePos({
            x: ((e.clientX / window.innerWidth) - 0.5) * 40,
            y: ((e.clientY / window.innerHeight) - 0.5) * 40,
        });
    };
    const [showAuthCard, setShowAuthCard] = useState(false);
    const inputRef = useRef(null);
    const particles = useRef(createParticles());
    const biometricTimeoutRef = useRef(null);
    const biometricActiveRef = useRef(false);

    // Decide initial mode based on biometric availability
    const fingerprintMode = biometricAvailable && !showPasswordMode;

    // Clock
    useEffect(() => {
        if (!isLocked) return;
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, [isLocked]);

    // Reset state when lock screen appears
    useEffect(() => {
        if (isLocked) {
            setPassword('');
            setError('');
            setUnlocking(false);
            setShowPasswordMode(false);
            setLoading(false);
            setBiometricChecking(false);
            setShowAuthCard(false);
            biometricActiveRef.current = false;
            if (biometricTimeoutRef.current) {
                clearTimeout(biometricTimeoutRef.current);
                biometricTimeoutRef.current = null;
            }
            invoke('get_current_username').then(setUsername).catch(() => { });
        }
    }, [isLocked]);

    // Focus password input when authentication UI requires it
    useEffect(() => {
        if (!isLocked || unlocking) return;
        // If Auth screen is visible and fingerprint is either completely unavailable
        // or explicitly bypassed, demand strict focus onto the password input.
        if (showAuthCard && !fingerprintMode && inputRef.current) {
            const t = setTimeout(() => inputRef.current?.focus(), 250);
            return () => clearTimeout(t);
        }
    }, [isLocked, showAuthCard, fingerprintMode, unlocking]);

    const handleSubmit = useCallback(async (e) => {
        e?.preventDefault();
        if (!password.trim() || loading) return;
        setLoading(true);
        setError('');
        try {
            const valid = await invoke('validate_password', { password });
            if (valid) {
                setUnlocking(true);
                setTimeout(() => onUnlock(), 800);
            } else {
                setError('Incorrect password');
                setShakeKey((k) => k + 1);
                setPassword('');
                inputRef.current?.focus();
            }
        } catch (err) {
            setError(String(err));
            setShakeKey((k) => k + 1);
        } finally {
            setLoading(false);
        }
    }, [password, loading, onUnlock]);

    useEffect(() => {
        let unlisten;
        (async () => {
            try {
                unlisten = await listen('biometric-result', (event) => {
                    if (!biometricActiveRef.current) return;
                    biometricActiveRef.current = false;
                    if (biometricTimeoutRef.current) {
                        clearTimeout(biometricTimeoutRef.current);
                        biometricTimeoutRef.current = null;
                    }

                    const result = event.payload;
                    if (result) {
                        setUnlocking(true);
                        setTimeout(() => onUnlock(), 800);
                    } else {
                        setError('Fingerprint was not scanned. Use password instead.');
                        setShowPasswordMode(true);
                        setBiometricChecking(false);
                    }
                });
            } catch (e) { }
        })();
        return () => { if (unlisten) unlisten(); };
    }, [onUnlock]);

    const handleBiometric = useCallback(async () => {
        if (biometricChecking || !isLocked || !biometricAvailable || showPasswordMode) return;
        setBiometricChecking(true);
        setError('');
        biometricActiveRef.current = true;
        if (biometricTimeoutRef.current) {
            clearTimeout(biometricTimeoutRef.current);
        }
        biometricTimeoutRef.current = setTimeout(() => {
            if (!biometricActiveRef.current) return;
            biometricActiveRef.current = false;
            biometricTimeoutRef.current = null;
            setBiometricChecking(false);
            setShowPasswordMode(true);
            setError('Fingerprint timed out. Use password instead.');
        }, 20000);

        try {
            await invoke('request_biometric_auth');
            // Result will be handled by the biometric-result event listener
        } catch {
            biometricActiveRef.current = false;
            if (biometricTimeoutRef.current) {
                clearTimeout(biometricTimeoutRef.current);
                biometricTimeoutRef.current = null;
            }
            setError('Biometric not available. Use password.');
            setShowPasswordMode(true);
            setBiometricChecking(false);
        }
    }, [biometricAvailable, biometricChecking, isLocked, showPasswordMode]);

    // Show auth card on Enter key only
    useEffect(() => {
        if (!isLocked || unlocking) return;

        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();

                // First show auth card if not visible
                if (!showAuthCard) {
                    setShowAuthCard(true);
                    return;
                }

                // Then trigger authentication
                if (fingerprintMode) {
                    handleBiometric();
                } else {
                    handleSubmit(e);
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isLocked, unlocking, showAuthCard, fingerprintMode, handleBiometric, handleSubmit]);

    // Battery Hook
    useEffect(() => {
        let battery = null;
        let disposed = false;
        let update = null;

        if ('getBattery' in navigator) {
            navigator.getBattery().then((b) => {
                if (disposed) return;
                battery = b;
                update = () => {
                    setBatteryLevel(Math.round(b.level * 100));
                    setIsCharging(b.charging);
                };
                update();
                b.addEventListener('levelchange', update);
                b.addEventListener('chargingchange', update);
            });
        }
        return () => {
            disposed = true;
            if (battery && update) {
                battery.removeEventListener('levelchange', update);
                battery.removeEventListener('chargingchange', update);
            }
        };
    }, []);

    // Power Menu Outside Click
    useEffect(() => {
        const handler = (e) => {
            if (powerMenuRef.current && !powerMenuRef.current.contains(e.target)) {
                setShowPowerMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => () => {
        biometricActiveRef.current = false;
        if (biometricTimeoutRef.current) {
            clearTimeout(biometricTimeoutRef.current);
        }
    }, []);

    const formatTime = (d) =>
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const formatDate = (d) =>
        d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <AnimatePresence>
            {isLocked && (
                <motion.div
                    className="lockscreen"
                    onMouseMove={handleMouseMove}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: unlocking ? 0 : 1 }}
                    exit={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                >
                    {/* ── Animated Background ── */}
                    <div className="lockscreen-bg">
                        <motion.div
                            className="lockscreen-gradient"
                            animate={{
                                x: mousePos.x * 2,
                                y: mousePos.y * 2
                            }}
                            transition={{ type: "spring", stiffness: 35, damping: 25 }}
                        />
                        <motion.div
                            className="lockscreen-particles"
                            animate={{
                                x: mousePos.x * -1.5,
                                y: mousePos.y * -1.5
                            }}
                            transition={{ type: "spring", stiffness: 45, damping: 25 }}
                        >
                            {particles.current.map((p) => (
                                <div
                                    key={p.id}
                                    className="lockscreen-particle"
                                    style={{
                                        left: `${p.x}%`,
                                        top: `${p.y}%`,
                                        width: `${p.size}px`,
                                        height: `${p.size}px`,
                                        opacity: p.opacity,
                                        animationDuration: `${p.duration}s`,
                                        animationDelay: `${p.delay}s`,
                                    }}
                                />
                            ))}
                        </motion.div>
                        <div className="lockscreen-aurora" />
                    </div>

                    {/* ── Content ── */}
                    <motion.div
                        className="lockscreen-content"
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: unlocking ? -40 : 0, opacity: unlocking ? 0 : 1 }}
                        transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
                    >
                        {/* Clock */}
                        <div className="lockscreen-clock">
                            <motion.div
                                className="lockscreen-time"
                                key={formatTime(time)}
                                initial={{ opacity: 0.7, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                {formatTime(time)}
                            </motion.div>
                            <div className="lockscreen-date">{formatDate(time)}</div>
                        </div>
                    </motion.div>

                    {/* Auth Card - Top Left Corner */}
                    <motion.div
                        className="lockscreen-auth-card"
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={showAuthCard ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                    >
                        {showAuthCard && (
                            <>
                                <div className="lockscreen-auth-head">
                                    <div className="lockscreen-avatar">
                                        <div className="lockscreen-avatar-ring">
                                            <div className="lockscreen-avatar-inner">
                                                {fingerprintMode ? <FingerprintIcon size={34} /> : <LockKeyIcon />}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lockscreen-greeting">
                                        <span className="lockscreen-greeting-label">Welcome back</span>
                                        <span className="lockscreen-greeting-name">{username}</span>
                                    </div>

                                    <div className={`lockscreen-status-pill ${fingerprintMode ? 'active' : ''}`}>
                                        <span />
                                        {fingerprintMode ? 'Windows Hello' : 'Password'}
                                    </div>
                                </div>

                                {/* ── Fingerprint Mode ── */}
                                {fingerprintMode && (
                                    <motion.div
                                        className="lockscreen-fingerprint-section"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                    >
                                        <motion.div
                                            className="lockscreen-fingerprint-status"
                                            animate={{ scale: biometricChecking ? [1, 1.02, 1] : 1 }}
                                            transition={{ duration: 1.35, repeat: biometricChecking ? Infinity : 0 }}
                                        >
                                            <div className="lockscreen-scanner">
                                                <span className="lockscreen-scanner-ring ring-one" />
                                                <span className="lockscreen-scanner-ring ring-two" />
                                                <span className="lockscreen-scanner-ring ring-three" />
                                                <div className={`lockscreen-fingerprint-icon ${biometricChecking ? 'scanning' : ''}`}>
                                                    <FingerprintIcon size={52} />
                                                </div>
                                            </div>
                                            <div className="lockscreen-fingerprint-copy">
                                                <span>{biometricChecking ? 'Scanning fingerprint' : 'Ready to authenticate'}</span>
                                                <small>Touch the fingerprint reader</small>
                                            </div>
                                        </motion.div>

                                        <button
                                            className="lockscreen-switch-mode"
                                            onClick={() => {
                                                biometricActiveRef.current = false;
                                                if (biometricTimeoutRef.current) {
                                                    clearTimeout(biometricTimeoutRef.current);
                                                    biometricTimeoutRef.current = null;
                                                }
                                                setBiometricChecking(false);
                                                setShowPasswordMode(true);
                                            }}
                                            disabled={unlocking}
                                        >
                                            Use password instead
                                        </button>
                                    </motion.div>
                                )}

                                {/* ── Password Mode ── */}
                                {!fingerprintMode && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        style={{ width: '100%' }}
                                    >
                                        <motion.form
                                            className="lockscreen-form"
                                            onSubmit={handleSubmit}
                                            key={shakeKey}
                                            initial={shakeKey > 0 ? { x: 0 } : false}
                                            animate={shakeKey > 0 ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : {}}
                                            transition={{ duration: 0.45, ease: 'easeInOut' }}
                                        >
                                            <div className="lockscreen-input-wrap">
                                                <input
                                                    ref={inputRef}
                                                    type="password"
                                                    className="lockscreen-input"
                                                    placeholder="Enter password..."
                                                    value={password}
                                                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                                    disabled={loading || unlocking}
                                                    autoComplete="off"
                                                    spellCheck={false}
                                                />
                                                <button
                                                    type="submit"
                                                    className="lockscreen-submit"
                                                    disabled={!password.trim() || loading || unlocking}
                                                >
                                                    {loading ? (
                                                        <div className="lockscreen-spinner" />
                                                    ) : (
                                                        <ArrowRightIcon />
                                                    )}
                                                </button>
                                            </div>
                                        </motion.form>

                                        {/* Switch back to fingerprint if available */}
                                        {biometricAvailable && (
                                            <button
                                                className="lockscreen-switch-mode"
                                                onClick={() => { setShowPasswordMode(false); setError(''); }}
                                                disabled={unlocking}
                                                style={{ marginTop: 12 }}
                                            >
                                                <FingerprintIcon size={14} />
                                                <span style={{ marginLeft: 6 }}>Use fingerprint</span>
                                            </button>
                                        )}
                                    </motion.div>
                                )}

                                {/* Error Message */}
                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            className="lockscreen-error"
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            {error}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        )}
                    </motion.div>

                    {/* Bottom Elements (Hidden until Auth Card is shown) */}
                    <AnimatePresence>
                        {showAuthCard && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
                                style={{ width: '100%', pointerEvents: 'none' }}
                            >
                                {/* Bottom hint */}
                                <div className="lockscreen-hint">
                                    <span>Lyra Shell</span>
                                    <span className="lockscreen-hint-sep">·</span>
                                    <span>Arch × macOS</span>
                                </div>

                                {/* Bottom Right Controls (Battery + Power) */}
                                <div className="lockscreen-controls" style={{ pointerEvents: 'auto' }}>
                                    <div className="lockscreen-battery">
                                        <BatteryIcon level={batteryLevel} charging={isCharging} />
                                        <span>{batteryLevel}%</span>
                                    </div>
                                    <div className="lockscreen-power-wrapper" ref={powerMenuRef}>
                                        <button className="lockscreen-power-btn" onClick={() => setShowPowerMenu(!showPowerMenu)}>
                                            <ShutdownIcon />
                                        </button>
                                        <AnimatePresence>
                                            {showPowerMenu && (
                                                <motion.div
                                                    className="lockscreen-power-menu"
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95, pointerEvents: 'none' }}
                                                    transition={{ duration: 0.15 }}
                                                >
                                                    <button onClick={() => runAction('sleep')}>
                                                        <SleepIcon /> Sleep
                                                    </button>
                                                    <button onClick={() => runAction('restart')}>
                                                        <RestartIcon /> Restart
                                                    </button>
                                                    <button className="danger" onClick={() => runAction('shutdown')}>
                                                        <ShutdownIcon /> Shut down
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LockScreen;
