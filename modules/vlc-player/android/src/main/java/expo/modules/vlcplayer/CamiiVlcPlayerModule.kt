package expo.modules.vlcplayer

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CamiiVlcPlayerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CamiiVlcPlayer")

    Function("isAvailable") {
      true
    }

    View(CamiiVlcPlayerView::class) {
      Events(
        "onLoad",
        "onProgress",
        "onPlaying",
        "onPaused",
        "onBuffering",
        "onEnded",
        "onError",
        "onTracksChanged",
        "onSeekComplete"
      )

      Prop("source") { view: CamiiVlcPlayerView, source: Map<String, Any?>? ->
        view.setSourceConfig(source)
      }

      Prop("paused") { view: CamiiVlcPlayerView, paused: Boolean? ->
        view.setPausedProp(paused ?: false)
      }

      Prop("muted") { view: CamiiVlcPlayerView, muted: Boolean? ->
        view.setMutedProp(muted ?: false)
      }

      Prop("volume") { view: CamiiVlcPlayerView, volume: Int? ->
        view.setVolumeProp(volume ?: 100)
      }

      Prop("rate") { view: CamiiVlcPlayerView, rate: Float? ->
        view.setRateProp(rate ?: 1.0f)
      }

      Prop("audioTrack") { view: CamiiVlcPlayerView, trackId: Int? ->
        view.setAudioTrackProp(trackId)
      }

      Prop("subtitleTrack") { view: CamiiVlcPlayerView, trackId: Int? ->
        view.setSubtitleTrackProp(trackId)
      }

      Prop("subtitleDelayMs") { view: CamiiVlcPlayerView, delayMs: Long? ->
        view.setSubtitleDelayProp(delayMs ?: 0L)
      }

      Prop("scaleType") { view: CamiiVlcPlayerView, scaleType: String? ->
        view.setScaleTypeProp(scaleType)
      }

      AsyncFunction("seekTo") { view: CamiiVlcPlayerView, timeMs: Double ->
        view.seekToMs(timeMs.toLong())
      }

      AsyncFunction("seekBy") { view: CamiiVlcPlayerView, deltaMs: Double ->
        view.seekByMs(deltaMs.toLong())
      }

      AsyncFunction("setPaused") { view: CamiiVlcPlayerView, paused: Boolean ->
        view.setPausedProp(paused)
      }

      AsyncFunction("setAudioTrack") { view: CamiiVlcPlayerView, trackId: Int ->
        view.setAudioTrackProp(trackId)
      }

      AsyncFunction("setSubtitleTrack") { view: CamiiVlcPlayerView, trackId: Int ->
        view.setSubtitleTrackProp(trackId)
      }

      AsyncFunction("setSubtitleDelay") { view: CamiiVlcPlayerView, delayMs: Double ->
        view.setSubtitleDelayProp(delayMs.toLong())
      }

      AsyncFunction("setScaleType") { view: CamiiVlcPlayerView, scaleType: String ->
        view.setScaleTypeProp(scaleType)
      }

      AsyncFunction("setRate") { view: CamiiVlcPlayerView, rate: Double ->
        view.setRateProp(rate.toFloat())
      }

      AsyncFunction("reload") { view: CamiiVlcPlayerView ->
        view.reloadPlayback()
      }

      OnViewDestroys { view: CamiiVlcPlayerView ->
        view.releasePlayer()
      }
    }
  }
}
