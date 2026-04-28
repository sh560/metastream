'use strict'
;(function() {
  const mainWorldScript = function() {
    // Helper function to find the main video element
    const getVideoElement = () => {
      // Crunchyroll-specific selector for Bitmovin player
      const bitmovinVideo = document.querySelector('video#bitmovinplayer-video-null') ||
        document.querySelector('#player-container video') ||
        document.querySelector('.bitmovinplayer-container video')
      if (bitmovinVideo) return bitmovinVideo

      // Try to find video in the main player container
      const playerContainer = document.querySelector('[data-testid="player"]') ||
        document.querySelector('.simpl-player-container') ||
        document.querySelector('video[controlsList]')

      if (playerContainer && playerContainer.tagName === 'VIDEO') {
        return playerContainer
      }

      // Fallback: find all video elements and pick the largest one
      const videos = Array.from(document.querySelectorAll('video')).filter(video => {
        const rect = video.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })

      if (videos.length === 0) return null

      // Return the video with the largest area
      return videos.reduce((largest, current) => {
        const currentRect = current.getBoundingClientRect()
        const largestRect = largest.getBoundingClientRect()
        const currentArea = currentRect.width * currentRect.height
        const largestArea = largestRect.width * largestRect.height
        return currentArea > largestArea ? current : largest
      })
    }

    // Helper function to get play/pause button
    const getPlayPauseButton = () => {
      return document.querySelector('button[data-testid="play-pause-button"]')
    }

    // Helper function to get timeline/progress slider
    const getTimelineSlider = () => {
      return document.querySelector('input.timeline-slider')
    }

    let cachedVolumeSlider
    let cachedVolumeLabel
    let cachedVolumeTrackRoot
    let cachedVolumeProgressBar
    let cachedVolumeKnob
    let cachedVolumeIcon

    // Helper function to get volume slider and label
    const getVolumeSlider = () => {
      return cachedVolumeSlider || (cachedVolumeSlider = document.querySelector('input[data-testid="volume-slider"], input.volume-slider'))
    }

    const getVolumeLabel = () => {
      return cachedVolumeLabel || (cachedVolumeLabel = document.querySelector('[data-testid="volume-slider-percentage"]'))
    }

    const getVolumeTrackRoot = slider => {
      if (cachedVolumeTrackRoot) return cachedVolumeTrackRoot
      return (cachedVolumeTrackRoot = slider.closest('.Slider__progressTrack__1DhzK') || slider.closest('.volume-slider-content')?.parentElement)
    }

    const getVolumeProgressBar = trackRoot => {
      return cachedVolumeProgressBar || (cachedVolumeProgressBar = trackRoot.querySelector('.Slider__progressBar__3JyOz'))
    }

    const getVolumeKnob = trackRoot => {
      return cachedVolumeKnob || (cachedVolumeKnob = trackRoot.querySelector('.Slider__knob__axLVG'))
    }

    const getVolumeIcon = () => {
      return cachedVolumeIcon || (cachedVolumeIcon = document.querySelector('svg.volume-icon'))
    }

    const unscaleMetastreamVolume = volume => {
      if (!volume) return 0
      const linear = Math.log(volume * 1000) / 6.908
      return Math.min(1, Math.max(0, linear))
    }

    const syncVolumeUI = volume => {
      const slider = getVolumeSlider()
      const label = getVolumeLabel()
      if (!slider) return

      const displayVolume = unscaleMetastreamVolume(volume)
      const sliderMin = Number(slider.min) || 0
      const sliderMax = Number(slider.max) || 100
      const sliderStep = Number(slider.step) || (sliderMax > 1 ? 1 : 0.01)
      const percent = Math.min(100, Math.max(0, Math.round(displayVolume * 100)))
      let rawValue = sliderMin + (sliderMax - sliderMin) * displayVolume
      rawValue = Math.round(rawValue / sliderStep) * sliderStep
      const internalValue = Math.min(sliderMax, Math.max(sliderMin, rawValue))
      const oldSliderValue = slider.value

      console.log('Crunchyroll volume sync', {
        volume,
        displayVolume,
        percent,
        sliderMin,
        sliderMax,
        sliderStep,
        rawValue,
        internalValue,
        oldSliderValue,
        labelExists: !!label
      })

      if (!slider.dataset.volumeSyncListener) {
        slider.addEventListener('input', () => {
          const value = slider.value
          slider.setAttribute('aria-valuenow', value)
          if (slider.hasAttribute('aria-valuetext')) {
            slider.setAttribute('aria-valuetext', value)
          }
        })
        slider.dataset.volumeSyncListener = 'true'
      }

      slider.value = internalValue
      slider.setAttribute('aria-valuenow', String(internalValue))
      if (slider.hasAttribute('aria-valuetext')) {
        slider.setAttribute('aria-valuetext', `${percent}`)
      }
      slider.style.setProperty('--volume-percent', `${percent}%`)
      slider.dispatchEvent(new Event('input', { bubbles: true }))
      if (label) label.textContent = String(percent)

      const trackRoot = getVolumeTrackRoot(slider)
      const progressBar = trackRoot ? getVolumeProgressBar(trackRoot) : null
      const knob = trackRoot ? getVolumeKnob(trackRoot) : null

      if (progressBar) {
        progressBar.style.width = `${percent}%`
      }
      if (knob) {
        knob.style.left = `${percent}%`
      }

      const volumeIcon = getVolumeIcon()
      if (volumeIcon) {
        volumeIcon.dataset.muted = internalValue === 0 ? 'true' : 'false'
        const tier = internalValue === 0 ? 'mute' : percent <= 33 ? 'low' : percent <= 66 ? 'medium' : 'high'
        volumeIcon.dataset.volumeTier = tier
      }
    }

    document.addEventListener('volumechange', e => {
      if (!(e.target instanceof HTMLVideoElement)) return
      syncVolumeUI(e.target.muted ? 0 : e.target.volume)
    }, true)

    // Handle play event
    document.addEventListener('metastreamplay', e => {
      const video = getVideoElement()
      const button = getPlayPauseButton()
      console.log('Crunchyroll metastreamplay:', { video, button })

      if (!video && !button) return
      e.preventDefault()

      if (video) {
        if (video.paused) {
          video.play().catch(err => {
            console.warn('Failed to play video:', err)
            if (button) button.click()
          })
        }
        return
      }

      if (button) {
        button.click()
      }
    })

    // Handle pause event
    document.addEventListener('metastreampause', e => {
      const video = getVideoElement()
      const button = getPlayPauseButton()
      console.log('Crunchyroll metastreampause:', { video, button })

      if (!video && !button) return
      e.preventDefault()

      if (video) {
        if (!video.paused) {
          video.pause()
        }
        return
      }

      if (button) {
        button.click()
      }
    })

    // Handle seek event
    document.addEventListener('metastreamseek', e => {
      const video = getVideoElement()
      if (!video || !video.duration) {
        console.warn('Seek failed: video not ready', { 
          video: !!video, 
          duration: video?.duration 
        })
        return
      }

      e.preventDefault()
      const time = e.detail / 1000
      const clampedTime = Math.max(0, Math.min(time, video.duration))

      console.log('Seeking to:', { 
        requestedTime: time, 
        clampedTime, 
        videoDuration: video.duration,
        currentTime: video.currentTime
      })

      try {
        video.currentTime = clampedTime
        console.log('Set video.currentTime to:', clampedTime)
        
        // Also sync the timeline slider if available
        const slider = getTimelineSlider()
        if (slider) {
          console.log('Updating slider:', { 
            oldValue: slider.value, 
            newValue: clampedTime,
            sliderMax: slider.max
          })
          slider.value = clampedTime
          // Trigger input event to update UI
          slider.dispatchEvent(new Event('input', { bubbles: true }))
        }
      } catch (err) {
        console.warn('Failed to seek:', err)
      }
    })
  }

  // Inject inline script at top of DOM to execute as soon as possible
  const script = document.createElement('script')
  script.textContent = `(${mainWorldScript}());`
  document.documentElement.appendChild(script)
})()
