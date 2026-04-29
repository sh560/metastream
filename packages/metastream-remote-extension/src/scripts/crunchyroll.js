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
    let isProgrammaticVolumeSync = false

    const getVolumeSlider = () => {
      if (cachedVolumeSlider && cachedVolumeSlider.isConnected) return cachedVolumeSlider
      return (cachedVolumeSlider = document.querySelector('[data-testid="volume-slider"]'))
    }

    const getVolumeLabel = () => {
      if (cachedVolumeLabel && cachedVolumeLabel.isConnected) return cachedVolumeLabel
      return (cachedVolumeLabel = document.querySelector('[data-testid="volume-slider-percentage"]'))
    }

    // Metastream uses log-scaled volume; invert to get linear 0-1 (ln(v*1000) / ln(1000))
    const unscaleMetastreamVolume = volume => {
      if (!volume) return 0
      return Math.min(1, Math.max(0, Math.log(volume * 1000) / 6.908))
    }

    const syncVolumeUI = volume => {
      const slider = getVolumeSlider()
      if (!slider) return

      const displayVolume = unscaleMetastreamVolume(volume)
      const sliderMax = Number(slider.max) || 100
      const sliderStep = Number(slider.step) || 1
      const percent = Math.min(100, Math.max(0, Math.round(displayVolume * 100)))
      const rawValue = Math.round((sliderMax * displayVolume) / sliderStep) * sliderStep
      const internalValue = String(Math.min(sliderMax, Math.max(0, rawValue)))

      const oldValue = slider.value
      slider.value = internalValue
      slider.setAttribute('aria-valuenow', internalValue)
      slider.style.setProperty('--volume-percent', `${percent}%`)

      if (slider.value !== oldValue) {
        isProgrammaticVolumeSync = true
        slider.dispatchEvent(new Event('input', { bubbles: true }))
        setTimeout(() => { isProgrammaticVolumeSync = false }, 0)
      }

      const label = getVolumeLabel()
      if (label) label.textContent = String(percent)
    }

    document.addEventListener('volumechange', e => {
      if (!(e.target instanceof HTMLVideoElement)) return
      if (isProgrammaticVolumeSync) return
      syncVolumeUI(e.target.muted ? 0 : e.target.volume)
    }, true)

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
