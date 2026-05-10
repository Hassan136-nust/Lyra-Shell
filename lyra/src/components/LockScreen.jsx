import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';

/* ── Inline SVG Icons ─────────────────────────────────────────── */
const FingerprintIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
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

/* ── Particle Background ──────────────────────────────────────── */
const PARTICLE_COUNT = 60;

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
const LockScreen = ({ isLocked, onUnlock }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('User');
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricChecking, setBiometricChecking] = useState(false);
    const [time, setTime] = useState(new Date());
    const [unlocking, setUnlocking] = useState(false);
    const [shakeKey, setShakeKey] = useState(0);
    const inputRef = useRef(null);
    const particles = useRef(createParticles());

    // Clock
    useEffect(() => {
        if (!isLocked) return;
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, [isLocked]);

    // Focus input when lock screen appears
    useEffect(() => {
        if (isLocked && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 400);
        }
        if (isLocked) {
            setPassword('');
            setError('');
            setUnlocking(false);
        }
    }, [isLocked]);

    // Fetch username + biometric status
    useEffect(() => {
        if (!isLocked) return;
        invoke('get_current_username').then(setUsername).catch(() => { });
        invoke('check_biometric_available')
            .then((avail) => setBiometricAvailable(avail))
            .catch(() => setBiometricAvailable(false));
    }, [isLocked]);

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

    const handleBiometric = useCallback(async () => {
        if (biometricChecking) return;
        setBiometricChecking(true);
        setError('');
        try {
            const result = await invoke('request_biometric_auth');
            if (result) {
                setUnlocking(true);
                setTimeout(() => onUnlock(), 800);
            } else {
                setError('Biometric verification failed');
                setShakeKey((k) => k + 1);
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setBiometricChecking(false);
        }
    }, [biometricChecking, onUnlock]);

    const formatTime = (d) =>
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const formatDate = (d) =>
        d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <AnimatePresence>
            {isLocked && (
                <motion.div
                    className="lockscreen"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: unlocking ? 0 : 1 }}
                    exit={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                >
                    {/* ── Animated Background ── */}
                    <div className="lockscreen-bg">
                        {/* Gradient mesh */}
                        <div className="lockscreen-gradient" />

                        {/* Particles */}
                        <div className="lockscreen-particles">
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
                        </div>

                        {/* Aurora glow */}
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

                        {/* Avatar */}
                        <div className="lockscreen-avatar">
                            <div className="lockscreen-avatar-ring">
                                <div className="lockscreen-avatar-inner">
                                    <LockKeyIcon />
                                </div>
                            </div>
                        </div>

                        {/* Greeting */}
                        <div className="lockscreen-greeting">
                            <span className="lockscreen-greeting-label">Welcome back</span>
                            <span className="lockscreen-greeting-name">{username}</span>
                        </div>

                        {/* Password Form */}
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

                        {/* Biometric Button */}
                        {biometricAvailable && (
                            <motion.button
                                className="lockscreen-biometric"
                                onClick={handleBiometric}
                                disabled={biometricChecking || unlocking}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                <FingerprintIcon />
                                <span>{biometricChecking ? 'Verifying...' : 'Unlock with Windows Hello'}</span>
                            </motion.button>
                        )}
                    </motion.div>

                    {/* Bottom hint */}
                    <div className="lockscreen-hint">
                        <span>Lyra Shell</span>
                        <span className="lockscreen-hint-sep">·</span>
                        <span>Arch × macOS</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LockScreen;
