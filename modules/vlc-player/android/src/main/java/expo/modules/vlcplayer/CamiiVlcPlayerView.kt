package expo.modules.vlcplayer

import android.annotation.SuppressLint
import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.ViewGroup
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactContext
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.videolan.libvlc.Dialog
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.util.VLCVideoLayout

@SuppressLint("ViewConstructor")
class CamiiVlcPlayerView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext), LifecycleEventListener {

  override val shouldUseAndroidLayout: Boolean = true

  private val mainHandler = Handler(Looper.getMainLooper())

  internal val onLoad by EventDispatcher<Map<String, Any?>>()
  internal val onProgress by EventDispatcher<Map<String, Any?>>()
  internal val onPlaying by EventDispatcher<Map<String, Any?>>()
  internal val onPaused by EventDispatcher<Map<String, Any?>>()
  internal val onBuffering by EventDispatcher<Map<String, Any?>>()
  internal val onEnded by EventDispatcher<Map<String, Any?>>()
  internal val onError by EventDispatcher<Map<String, Any?>>()
  internal val onTracksChanged by EventDispatcher<Map<String, Any?>>()

  private var libVlc: LibVLC? = null
  private var mediaPlayer: MediaPlayer? = null
  private var videoLayout: VLCVideoLayout? = null

  private var currentUri: String? = null
  private var currentUserAgent: String? = null
  private var currentHeaders: Map<*, *>? = null
  private var currentRetryCount: Int = 0
  private var networkCachingMs: Int = 2500
  private var hardwareAcceleration: Boolean = true
  private var startPositionMs: Long = 0L
  private var hasAppliedStartPosition: Boolean = false
  private var desiredPaused: Boolean = false
  private var desiredMuted: Boolean = false
  private var desiredVolume: Int = 100
  private var desiredRate: Float = 1.0f
  private var desiredAudioTrack: Int? = null
  private var desiredSubtitleTrack: Int? = null
  private var desiredSubtitleDelayMs: Long = 0L
  private var desiredScaleType: String = "BEST_FIT"

  private var lastProgressEmitMs: Long = 0L
  private var lastTracksHash: String = ""
  private var hasEmittedLoad: Boolean = false
  private var wasPlayingBeforeHostPause: Boolean = false

  init {
    keepScreenOn = true
    setBackgroundColor(android.graphics.Color.BLACK)

    val activityOrContext = appContext.currentActivity ?: context
    val layout = VLCVideoLayout(activityOrContext).apply {
      layoutParams = LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }
    videoLayout = layout
    addView(layout)

    (appContext.reactContext as? ReactContext)?.addLifecycleEventListener(this)
  }

  fun setSourceConfig(source: Map<String, Any?>?) {
    if (source == null) {
      releasePlayer()
      currentUri = null
      return
    }

    val uri = (source["uri"] as? String)?.trim()
    if (uri.isNullOrEmpty()) {
      releasePlayer()
      currentUri = null
      return
    }

    val caching = (source["networkCachingMs"] as? Number)?.toInt() ?: 2500
    val hwAccel = (source["hardwareAcceleration"] as? Boolean) ?: true
    val startPos = (source["startPositionMs"] as? Number)?.toLong() ?: 0L
    val headers = source["headers"] as? Map<*, *>
    val userAgent = source["httpUserAgent"] as? String
    val retryCount = (source["retryCount"] as? Number)?.toInt() ?: 0

    if (
      uri == currentUri &&
      mediaPlayer != null &&
      hwAccel == hardwareAcceleration &&
      retryCount == currentRetryCount
    ) {
      return
    }

    currentUri = uri
    currentUserAgent = userAgent
    currentHeaders = headers
    currentRetryCount = retryCount
    networkCachingMs = caching.coerceIn(300, 15000)
    hardwareAcceleration = hwAccel
    startPositionMs = startPos
    hasAppliedStartPosition = false
    hasEmittedLoad = false
    lastTracksHash = ""

    startPlayback(uri, userAgent, headers)
  }

  fun reloadPlayback() {
    val uri = currentUri ?: return
    val player = mediaPlayer
    if (player != null && !player.isReleased) {
      val currentPos = player.getTime().coerceAtLeast(0L)
      if (currentPos > 0L) {
        startPositionMs = currentPos
      }
    }
    hasAppliedStartPosition = false
    hasEmittedLoad = false
    lastTracksHash = ""
    startPlayback(uri, currentUserAgent, currentHeaders)
  }

  private fun startPlayback(uriString: String, userAgent: String?, headers: Map<*, *>?) {
    mainHandler.post {
      try {
        releasePlayer()

        val options = arrayListOf(
          "--network-caching=$networkCachingMs",
          "--file-caching=2000",
          "--live-caching=$networkCachingMs",
          "--http-reconnect",
          "--clock-jitter=0",
          "--clock-synchro=0",
          "--freetype-rel-fontsize=16",
          "--sub-text-scale=100",
          "-vv"
        )

        val vlc = LibVLC(context.applicationContext, options)
        libVlc = vlc

        Dialog.setCallbacks(vlc, object : Dialog.Callbacks {
          override fun onDisplay(dialog: Dialog.QuestionDialog) {
            dialog.postAction(1)
          }
          override fun onDisplay(dialog: Dialog.ErrorMessage) {}
          override fun onDisplay(dialog: Dialog.LoginDialog) {
            dialog.dismiss()
          }
          override fun onDisplay(dialog: Dialog.ProgressDialog) {}
          override fun onCanceled(dialog: Dialog) {}
          override fun onProgressUpdate(dialog: Dialog.ProgressDialog) {}
        })

        val player = MediaPlayer(vlc)
        player.setUseOrientationFromBounds(true)
        mediaPlayer = player

        val layout = videoLayout
        if (layout != null) {
          // subtitles = true, textureView = false (uses SurfaceView + dedicated translucent ASS/SSA subtitle SurfaceView)
          player.attachViews(layout, null, true, false)
        }

        applyScaleTypeInternal(player, desiredScaleType)
        player.setEventListener(playerEventListener)

        val media = if (
          uriString.startsWith("http://", ignoreCase = true) ||
          uriString.startsWith("https://", ignoreCase = true) ||
          uriString.startsWith("rtsp://", ignoreCase = true) ||
          uriString.startsWith("mms://", ignoreCase = true) ||
          uriString.startsWith("content://", ignoreCase = true) ||
          uriString.startsWith("file://", ignoreCase = true)
        ) {
          Media(vlc, Uri.parse(uriString))
        } else {
          Media(vlc, uriString)
        }

        media.setHWDecoderEnabled(hardwareAcceleration, false)
        media.addOption(":network-caching=$networkCachingMs")

        if (!userAgent.isNullOrBlank()) {
          media.addOption(":http-user-agent=$userAgent")
        }
        val referer = headers?.get("Referer") as? String ?: headers?.get("referer") as? String
        if (!referer.isNullOrBlank()) {
          media.addOption(":http-referrer=$referer")
        }

        player.setMedia(media)
        media.release()

        player.setVolume(if (desiredMuted) 0 else desiredVolume)
        if (desiredRate != 1.0f) {
          player.setRate(desiredRate)
        }

        if (!desiredPaused) {
          player.play()
        }
      } catch (e: Exception) {
        Log.e("CamiiVlcPlayerView", "Error starting LibVLC playback", e)
        onError(
          mapOf(
            "message" to (e.message ?: "Erro ao iniciar o reprodutor LibVLC"),
            "uri" to uriString
          )
        )
      }
    }
  }

  private val playerEventListener = MediaPlayer.EventListener { event ->
    val player = mediaPlayer ?: return@EventListener
    when (event.type) {
      MediaPlayer.Event.Opening -> {
        onBuffering(mapOf("buffering" to 0.0, "isBuffering" to true))
      }

      MediaPlayer.Event.Buffering -> {
        val pct = event.buffering.toDouble()
        onBuffering(
          mapOf(
            "buffering" to pct,
            "isBuffering" to (pct < 100.0)
          )
        )
      }

      MediaPlayer.Event.Playing -> {
        keepScreenOn = true
        if (!hasAppliedStartPosition && startPositionMs > 0L) {
          hasAppliedStartPosition = true
          player.setTime(startPositionMs, true)
        }
        if (desiredSubtitleDelayMs != 0L) {
          player.setSpuDelay(desiredSubtitleDelayMs * 1000L)
        }
        checkAndEmitTracks(player, forceEmitLoad = !hasEmittedLoad)
        onPlaying(
          mapOf(
            "currentTime" to player.getTime().coerceAtLeast(0L).toDouble(),
            "duration" to player.getLength().coerceAtLeast(0L).toDouble(),
            "isPlaying" to true
          )
        )
      }

      MediaPlayer.Event.Paused -> {
        onPaused(
          mapOf(
            "currentTime" to player.getTime().coerceAtLeast(0L).toDouble(),
            "duration" to player.getLength().coerceAtLeast(0L).toDouble(),
            "isPlaying" to false
          )
        )
      }

      MediaPlayer.Event.TimeChanged -> {
        val now = System.currentTimeMillis()
        if (now - lastProgressEmitMs >= 200L) {
          lastProgressEmitMs = now
          val currentTime = event.timeChanged.coerceAtLeast(0L)
          val duration = player.getLength().coerceAtLeast(0L)
          val pos = if (duration > 0L) (currentTime.toDouble() / duration.toDouble()) else player.getPosition().toDouble()

          onProgress(
            mapOf(
              "currentTime" to currentTime.toDouble(),
              "duration" to duration.toDouble(),
              "position" to pos,
              "isPlaying" to player.isPlaying()
            )
          )
          checkAndEmitTracks(player, forceEmitLoad = !hasEmittedLoad)
        }
      }

      MediaPlayer.Event.LengthChanged,
      MediaPlayer.Event.ESAdded,
      MediaPlayer.Event.ESDeleted,
      MediaPlayer.Event.ESSelected,
      MediaPlayer.Event.Vout -> {
        player.updateVideoSurfaces()
        checkAndEmitTracks(player, forceEmitLoad = !hasEmittedLoad)
      }

      MediaPlayer.Event.EndReached -> {
        keepScreenOn = false
        val totalLen = player.getLength().coerceAtLeast(0L)
        if (!hasEmittedLoad && totalLen <= 0L) {
          onError(
            mapOf(
              "message" to "O servidor Webtor ainda estava preparando o vídeo na primeira execução. Clique em Tentar Novamente.",
              "uri" to (currentUri ?: "")
            )
          )
        } else {
          onEnded(
            mapOf(
              "currentTime" to totalLen.toDouble(),
              "duration" to totalLen.toDouble()
            )
          )
        }
      }

      MediaPlayer.Event.EncounteredError -> {
        keepScreenOn = false
        onError(
          mapOf(
            "message" to "Falha ao reproduzir o stream de vídeo no LibVLC.",
            "uri" to (currentUri ?: "")
          )
        )
      }
    }
  }

  private fun checkAndEmitTracks(player: MediaPlayer, forceEmitLoad: Boolean = false) {
    if (player.isReleased) return

    val audioDescs = player.getAudioTracks() ?: emptyArray()
    val spuDescs = player.getSpuTracks() ?: emptyArray()
    val currentAudioId = player.getAudioTrack()
    val currentSpuId = player.getSpuTrack()
    val duration = player.getLength().coerceAtLeast(0L)

    val audioList = audioDescs.map { track ->
      mapOf(
        "id" to track.id,
        "name" to (track.name ?: "Faixa ${track.id}")
      )
    }

    val subtitleList = spuDescs.map { track ->
      mapOf(
        "id" to track.id,
        "name" to (track.name ?: if (track.id == -1) "Desativado" else "Legenda ${track.id}")
      )
    }

    // Apply desired tracks if set via prop and not yet active
    desiredAudioTrack?.let { targetId ->
      if (targetId != currentAudioId && audioDescs.any { it.id == targetId }) {
        player.setAudioTrack(targetId)
      }
    }

    desiredSubtitleTrack?.let { targetId ->
      if (targetId != currentSpuId && (targetId == -1 || spuDescs.any { it.id == targetId })) {
        player.setSpuTrack(targetId)
      }
    }

    val hashBuilder = StringBuilder()
    hashBuilder.append("d=").append(duration)
      .append(";ca=").append(player.getAudioTrack())
      .append(";cs=").append(player.getSpuTrack())
      .append(";a=")
    for (a in audioDescs) {
      hashBuilder.append(a.id).append(":").append(a.name).append(",")
    }
    hashBuilder.append(";s=")
    for (s in spuDescs) {
      hashBuilder.append(s.id).append(":").append(s.name).append(",")
    }

    val newHash = hashBuilder.toString()
    if (forceEmitLoad || newHash != lastTracksHash) {
      lastTracksHash = newHash

      val videoTrack = try {
        player.getCurrentVideoTrack()
      } catch (_: Exception) {
        null
      }

      val payload = mapOf(
        "duration" to duration.toDouble(),
        "currentTime" to player.getTime().coerceAtLeast(0L).toDouble(),
        "audioTracks" to audioList,
        "subtitleTracks" to subtitleList,
        "selectedAudioTrack" to player.getAudioTrack(),
        "selectedSubtitleTrack" to player.getSpuTrack(),
        "videoWidth" to (videoTrack?.width ?: 0),
        "videoHeight" to (videoTrack?.height ?: 0)
      )

      if (!hasEmittedLoad && (duration > 0L || audioList.isNotEmpty() || subtitleList.isNotEmpty())) {
        hasEmittedLoad = true
        onLoad(payload)
      }
      onTracksChanged(payload)
    }
  }

  fun setPausedProp(paused: Boolean) {
    desiredPaused = paused
    val player = mediaPlayer ?: return
    if (player.isReleased) return
    if (paused) {
      if (player.isPlaying) {
        player.pause()
      }
    } else {
      if (!player.isPlaying) {
        player.play()
      }
    }
  }

  fun setMutedProp(muted: Boolean) {
    desiredMuted = muted
    val player = mediaPlayer ?: return
    if (player.isReleased) return
    player.setVolume(if (muted) 0 else desiredVolume)
  }

  fun setVolumeProp(volume: Int) {
    desiredVolume = volume.coerceIn(0, 200)
    val player = mediaPlayer ?: return
    if (player.isReleased) return
    if (!desiredMuted) {
      player.setVolume(desiredVolume)
    }
  }

  fun setRateProp(rate: Float) {
    val safeRate = rate.coerceIn(0.25f, 4.0f)
    desiredRate = safeRate
    val player = mediaPlayer ?: return
    if (player.isReleased) return
    player.setRate(safeRate)
  }

  fun setAudioTrackProp(trackId: Int?) {
    desiredAudioTrack = trackId
    if (trackId == null) return
    val player = mediaPlayer ?: return
    if (player.isReleased) return
    player.setAudioTrack(trackId)
    checkAndEmitTracks(player)
  }

  fun setSubtitleTrackProp(trackId: Int?) {
    desiredSubtitleTrack = trackId
    if (trackId == null) return
    val player = mediaPlayer ?: return
    if (player.isReleased) return
    player.setSpuTrack(trackId)
    checkAndEmitTracks(player)
  }

  fun setSubtitleDelayProp(delayMs: Long) {
    desiredSubtitleDelayMs = delayMs
    val player = mediaPlayer ?: return
    if (player.isReleased) return
    // LibVLC spuDelay is in microseconds
    player.setSpuDelay(delayMs * 1000L)
  }

  fun setScaleTypeProp(scaleType: String?) {
    val resolved = scaleType ?: "BEST_FIT"
    desiredScaleType = resolved
    val player = mediaPlayer ?: return
    if (player.isReleased) return
    applyScaleTypeInternal(player, resolved)
  }

  private fun applyScaleTypeInternal(player: MediaPlayer, scaleType: String) {
    val vlcScale = when (scaleType.uppercase()) {
      "FIT_SCREEN", "COVER" -> MediaPlayer.ScaleType.SURFACE_FIT_SCREEN
      "FILL", "STRETCH" -> MediaPlayer.ScaleType.SURFACE_FILL
      "16_9", "16:9" -> MediaPlayer.ScaleType.SURFACE_16_9
      "4_3", "4:3" -> MediaPlayer.ScaleType.SURFACE_4_3
      "ORIGINAL" -> MediaPlayer.ScaleType.SURFACE_ORIGINAL
      else -> MediaPlayer.ScaleType.SURFACE_BEST_FIT
    }
    player.setVideoScale(vlcScale)
    player.updateVideoSurfaces()
  }

  fun seekToMs(timeMs: Long) {
    val player = mediaPlayer ?: return
    if (player.isReleased) return
    val length = player.getLength()
    val target = if (length > 0L) timeMs.coerceIn(0L, length) else timeMs.coerceAtLeast(0L)
    player.setTime(target, true)
    onProgress(
      mapOf(
        "currentTime" to target.toDouble(),
        "duration" to length.coerceAtLeast(0L).toDouble(),
        "position" to if (length > 0L) (target.toDouble() / length.toDouble()) else 0.0,
        "isPlaying" to player.isPlaying()
      )
    )
  }

  fun seekByMs(deltaMs: Long) {
    val player = mediaPlayer ?: return
    if (player.isReleased) return
    val current = player.getTime().coerceAtLeast(0L)
    seekToMs(current + deltaMs)
  }

  fun releasePlayer() {
    val player = mediaPlayer
    mediaPlayer = null
    if (player != null) {
      try {
        player.setEventListener(null)
        if (player.isPlaying) {
          player.stop()
        }
        player.detachViews()
        player.release()
      } catch (e: Exception) {
        Log.w("CamiiVlcPlayerView", "Error releasing MediaPlayer", e)
      }
    }

    val vlc = libVlc
    libVlc = null
    if (vlc != null) {
      try {
        Dialog.setCallbacks(vlc, null)
        vlc.release()
      } catch (e: Exception) {
        Log.w("CamiiVlcPlayerView", "Error releasing LibVLC", e)
      }
    }
  }

  override fun onHostResume() {
    val player = mediaPlayer ?: return
    if (!player.isReleased && wasPlayingBeforeHostPause && !desiredPaused) {
      wasPlayingBeforeHostPause = false
      player.play()
    }
  }

  override fun onHostPause() {
    val player = mediaPlayer ?: return
    if (!player.isReleased && player.isPlaying) {
      wasPlayingBeforeHostPause = true
      player.pause()
    }
  }

  override fun onHostDestroy() {
    releasePlayer()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    (appContext.reactContext as? ReactContext)?.removeLifecycleEventListener(this)
    releasePlayer()
  }
}
