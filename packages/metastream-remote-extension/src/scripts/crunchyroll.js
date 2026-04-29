'use strict'
;(function() {
  const mainWorldScript = function() {
    const getVideoElement = () => {
      const bitmovinVideo =
        document.querySelector('video#bitmovinplayer-video-null') ||
        document.querySelector('#player-container video') ||
        document.querySelector('.bitmovinplayer-container video')
      if (bitmovinVideo) return bitmovinVideo

      const playerContainer =
        document.querySelector('[data-testid="player"]') ||
        document.querySelector('.simpl-player-container') ||
        document.querySelector('video[controlsList]')
      if (playerContainer && playerContainer.tagName === 'VIDEO') return playerContainer

      const videos = Array.from(document.querySelectorAll('video')).filter(v => {
        const rect = v.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      if (videos.length === 0) return null

      return videos.reduce((largest, current) => {
        const a = current.getBoundingClientRect()
        const b = largest.getBoundingClientRect()
        return a.width * a.height > b.width * b.height ? current : largest
      })
    }

    const getPlayPauseButton = () =>
      document.querySelector('button[data-testid="play-pause-button"]')

    const getTimelineSlider = () =>
      document.querySelector('input.timeline-slider')

    let cachedVolumeSlider
    let cachedVolumeLabel

    const getVolumeSlider = () => {
      if (cachedVolumeSlider && cachedVolumeSlider.isConnected) return cachedVolumeSlider
      return (cachedVolumeSlider = document.querySelector('[data-testid="volume-slider"]'))
    }

    const getVolumeLabel = () => {
      if (cachedVolumeLabel && cachedVolumeLabel.isConnected) return cachedVolumeLabel
      return (cachedVolumeLabel = document.querySelector('[data-testid="volume-slider-percentage"]'))
    }

    const syncVolumeUI = percent => {
      const slider = getVolumeSlider()
      if (slider) {
        const value = String(percent)
        slider.value = value
        slider.setAttribute('aria-valuenow', value)
        slider.style.setProperty('--volume-percent', `${percent}%`)
      }
      const label = getVolumeLabel()
      if (label) label.textContent = String(percent)
    }

    // Crunchyroll's slider max is 92, not 100 — video.volume = sliderValue / 100,
    // so slider = video.volume * 100. Metastream sends video.volume directly as
    // set-media-volume payload, meaning displayPercent = round(payload * 92).
    // We listen on the message directly (not volumechange) because Crunchyroll's
    // own handler resets the slider after volumechange fires.
    window.addEventListener('message', e => {
      if (e.origin !== location.origin) return
      const { data } = e
      if (!data || data.type !== 'set-media-volume') return

      const payload = data.payload
      const percent = Math.round(payload * 92)

      console.log('[metastream:crunchyroll] set-media-volume', { payload, percent })

      setTimeout(() => {
        const slider = getVolumeSlider()
        console.log('[metastream:crunchyroll] syncVolumeUI (deferred)', {
          payload,
          percent,
          sliderBefore: slider ? slider.value : 'not found',
        })
        syncVolumeUI(percent)
      }, 0)
    })

    document.addEventListener('metastreamplay', e => {
      const video = getVideoElement()
      const button = getPlayPauseButton()
      if (!video && !button) return
      e.preventDefault()

      if (video) {
        if (video.paused) {
          video.play().catch(() => { if (button) button.click() })
        }
        return
      }
      button.click()
    })

    document.addEventListener('metastreampause', e => {
      const video = getVideoElement()
      const button = getPlayPauseButton()
      if (!video && !button) return
      e.preventDefault()

      if (video) {
        if (!video.paused) video.pause()
        return
      }
      button.click()
    })

    window.addEventListener('pagehide', () => {
      const video = getVideoElement()
      if (video && !video.paused) video.pause()
    })

    document.addEventListener('metastreamseek', e => {
      const video = getVideoElement()
      if (!video || !video.duration) return

      e.preventDefault()
      const clampedTime = Math.max(0, Math.min(e.detail / 1000, video.duration))

      try {
        video.currentTime = clampedTime

        const slider = getTimelineSlider()
        if (slider) {
          const percent = (clampedTime / video.duration) * 100
          slider.value = clampedTime
          slider.setAttribute('aria-valuenow', clampedTime)
          slider.style.setProperty('--timeline-progress-percent', `${percent}%`)
          slider.dispatchEvent(new Event('input', { bubbles: true }))
        }
      } catch (_) {
        // video not seekable
      }
    })
  }

  const script = document.createElement('script')
  script.textContent = `(${mainWorldScript}());`
  document.documentElement.appendChild(script)
})()
