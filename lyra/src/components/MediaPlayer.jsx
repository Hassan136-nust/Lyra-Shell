import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';

/* ── Media Player Icons ─────────────────────────────────────────── */
const PlayPauseIcon = ({ isPlaying }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        {isPlaying ? (
            <>
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
            </>
        ) : (
            <polygon points="5 3 19 12 5 21" />
        )}
    </svg>
);

const NextIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 4 15 12 5 20" />
        <rect x="16" y="4" width="2" height="16" />
    </svg>
);

const PreviousIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="19 4 9 12 19 20" transform="scale(-1, 1) translate(-24, 0)" />
        <rect x="6" y="4" width="2" height="16" />
    </svg>
);

/* ── Mini Media Indicator for TopBar ───────────────────────────── */
const MediaTopBarIndicator = ({ media, onClick }) => {
    if (!media) return null;

    return (
        <motion.button
            className="topbar-media-indicator"
            onClick={onClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
        >
            <div className="topbar-media-icon">
                {media.is_playing ? (
                    <div className="equalizer">
                        <div className="bar" />
                        <div className="bar" />
                        <div className="bar" />
                    </div>
                ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                        <polygon points="10 8 10 16 16 12" fill="currentColor" />
                    </svg>
                )}
            </div>
            <span className="topbar-media-text">{media.title || 'No Media'}</span>
        </motion.button>
    );
};

/* ── Full Media Card Popup ────────────────────────────────────── */
const MediaCard = ({ media, onClose, onPlayPause, onNext, onPrevious }) => {
    if (!media) return null;

    const progress = media.duration_ms > 0 ? (media.position_ms / media.duration_ms) * 100 : 0;

    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <motion.div
            className="media-card-overlay"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="media-card"
                onClick={(e) => e.stopPropagation()}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
            >
                {/* Header */}
                <div className="media-card-header">
                    <div className="media-app-label">
                        <span className="media-app-name">{media.app_name || 'Unknown App'}</span>
                    </div>
                    <button className="media-card-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* Album Art / Placeholder */}
                <div className="media-card-art">
                    <div className="media-art-placeholder">
                        {media.is_playing ? (
                            <div className="equalizer-large">
                                <div className="bar" style={{ animationDelay: '0s' }} />
                                <div className="bar" style={{ animationDelay: '0.2s' }} />
                                <div className="bar" style={{ animationDelay: '0.4s' }} />
                                <div className="bar" style={{ animationDelay: '0.6s' }} />
                            </div>
                        ) : (
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="12" cy="12" r="10" />
                                <polygon points="10 8 10 16 16 12" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Title and Artist */}
                <div className="media-card-info">
                    <h3 className="media-title">{media.title || 'Unknown Title'}</h3>
                    <p className="media-artist">{media.artist || 'Unknown Artist'}</p>
                </div>

                {/* Progress Bar */}
                <div className="media-progress-container">
                    <div className="media-progress-bar">
                        <div
                            className="media-progress-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="media-time">
                        <span>{formatTime(media.position_ms)}</span>
                        <span>{formatTime(media.duration_ms)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="media-controls">
                    <motion.button
                        className="media-btn media-btn-prev"
                        onClick={onPrevious}
                        disabled={!media.supports_previous}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <PreviousIcon />
                    </motion.button>

                    <motion.button
                        className="media-btn media-btn-play"
                        onClick={onPlayPause}
                        disabled={!media.supports_play_pause}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <PlayPauseIcon isPlaying={media.is_playing} />
                    </motion.button>

                    <motion.button
                        className="media-btn media-btn-next"
                        onClick={onNext}
                        disabled={!media.supports_next}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <NextIcon />
                    </motion.button>
                </div>

                {/* Status Badge */}
                <div className="media-status">
                    {media.is_playing ? (
                        <span className="status-badge status-playing">▶ Playing</span>
                    ) : (
                        <span className="status-badge status-paused">⏸ Paused</span>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

/* ── Media Player Manager Component ────────────────────────────── */
const MediaPlayer = () => {
    const [media, setMedia] = useState(null);
    const [showCard, setShowCard] = useState(false);
    const [loading, setLoading] = useState(false);

    // Fetch current media every 1.5 seconds
    useEffect(() => {
        const fetchMedia = async () => {
            setLoading(true);
            try {
                const result = await invoke('get_current_media');
                setMedia(result);
            } catch (e) {
                console.error('[MediaPlayer] Error fetching media:', e);
                setMedia(null);
            }
            setLoading(false);
        };

        fetchMedia();
        const interval = setInterval(fetchMedia, 1500);

        return () => clearInterval(interval);
    }, []);

    const handlePlayPause = useCallback(async () => {
        try {
            await invoke('media_play_pause');
            // Refresh media info after control
            setTimeout(async () => {
                const result = await invoke('get_current_media');
                setMedia(result);
            }, 200);
        } catch (e) {
            console.error('[MediaPlayer] Play/pause failed:', e);
        }
    }, []);

    const handleNext = useCallback(async () => {
        try {
            await invoke('media_next');
            setTimeout(async () => {
                const result = await invoke('get_current_media');
                setMedia(result);
            }, 200);
        } catch (e) {
            console.error('[MediaPlayer] Next failed:', e);
        }
    }, []);

    const handlePrevious = useCallback(async () => {
        try {
            await invoke('media_previous');
            setTimeout(async () => {
                const result = await invoke('get_current_media');
                setMedia(result);
            }, 200);
        } catch (e) {
            console.error('[MediaPlayer] Previous failed:', e);
        }
    }, []);

    return (
        <>
            <MediaTopBarIndicator
                media={media}
                onClick={() => setShowCard(!showCard)}
            />
            <AnimatePresence>
                {showCard && (
                    <MediaCard
                        media={media}
                        onClose={() => setShowCard(false)}
                        onPlayPause={handlePlayPause}
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default MediaPlayer;
