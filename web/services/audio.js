// Audio service for Stash app
// Handles audio playback for TTS-generated content

import { appState, setAudio, setIsPlaying } from '../lib/state.js';
import { formatTime } from '../lib/utils.js';
import { getSignedAudioUrl } from './supabase.js';

/**
 * Initialize audio player with a URL
 * @param {string} url - Audio URL (storage path)
 * @returns {Promise<void>}
 */
export async function initAudio(url) {
  stopAudio();

  // Extract filename from URL and get a signed URL
  const filename = url.split('/').pop();
  const signedUrl = await getSignedAudioUrl(filename);

  if (!signedUrl) {
    console.error('Failed to get signed URL for audio');
    return;
  }

  const audio = new Audio(signedUrl);
  setAudio(audio);
  setIsPlaying(false);

  // Reset UI
  const progressEl = document.getElementById('audio-progress');
  const currentEl = document.getElementById('audio-current');
  const durationEl = document.getElementById('audio-duration');
  const speedEl = document.getElementById('audio-speed');

  if (progressEl) progressEl.style.width = '0%';
  if (currentEl) currentEl.textContent = '0:00';
  if (durationEl) durationEl.textContent = '0:00';
  if (speedEl) speedEl.value = '1';

  updatePlayButton();

  // Set up event listeners
  audio.addEventListener('loadedmetadata', () => {
    if (durationEl) {
      durationEl.textContent = formatTime(audio.duration);
    }
  });

  audio.addEventListener('timeupdate', () => {
    const progress = (audio.currentTime / audio.duration) * 100;
    if (progressEl) progressEl.style.width = `${progress}%`;
    if (currentEl) currentEl.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('ended', () => {
    setIsPlaying(false);
    updatePlayButton();
  });

  audio.addEventListener('error', (e) => {
    console.error('Audio error:', e);
  });
}

/**
 * Toggle audio playback (play/pause)
 */
export function toggleAudioPlayback() {
  if (!appState.audio) return;

  if (appState.isPlaying) {
    appState.audio.pause();
    setIsPlaying(false);
  } else {
    appState.audio.play();
    setIsPlaying(true);
  }
  updatePlayButton();
}

/**
 * Stop audio playback and cleanup
 */
export function stopAudio() {
  if (appState.audio) {
    appState.audio.pause();
    appState.audio.src = '';
    setAudio(null);
    setIsPlaying(false);
    updatePlayButton();
  }
}

/**
 * Update play/pause button UI
 */
export function updatePlayButton() {
  const playIcon = document.querySelector('#audio-play-btn .play-icon');
  const pauseIcon = document.querySelector('#audio-play-btn .pause-icon');

  if (!playIcon || !pauseIcon) return;

  if (appState.isPlaying) {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
  } else {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  }
}

/**
 * Set audio playback speed
 * @param {number} speed - Playback speed (0.5 to 2)
 */
export function setPlaybackSpeed(speed) {
  if (appState.audio) {
    appState.audio.playbackRate = speed;
  }
}

/**
 * Seek to a position in the audio
 * @param {number} percent - Position as percentage (0-100)
 */
export function seekTo(percent) {
  if (appState.audio && appState.audio.duration) {
    appState.audio.currentTime = (percent / 100) * appState.audio.duration;
  }
}

/**
 * Check if audio is currently playing
 * @returns {boolean}
 */
export function isPlaying() {
  return appState.isPlaying;
}

/**
 * Get current audio element
 * @returns {HTMLAudioElement|null}
 */
export function getAudio() {
  return appState.audio;
}
