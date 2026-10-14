package com.sonidocelestial.radio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.audiofx.Visualizer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.annotation.OptIn
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionParameters
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.session.MediaSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class AudioService : Service() {

    companion object {
        private const val TAG = "AudioService"
        const val CHANNEL_ID = "radio_playback"
        const val NOTIFICATION_ID = 1
        const val ACTION_PLAY = "com.sonidocelestial.radio.PLAY"
        const val ACTION_PAUSE = "com.sonidocelestial.radio.PAUSE"
        const val ACTION_STOP = "com.sonidocelestial.radio.STOP"
        const val ACTION_UPDATE_METADATA = "com.sonidocelestial.radio.UPDATE_METADATA"
        const val EXTRA_URL = "url"
        const val EXTRA_TITLE = "title"
        const val EXTRA_ARTIST = "artist"
        const val EXTRA_ALBUM_ART = "albumArt"

        @Volatile
        var instance: AudioService? = null
    }

    private var exoPlayer: ExoPlayer? = null
    private var mediaSession: MediaSession? = null
    private var currentTitle = "Radio Sonido Celestial"
    private var currentArtist = "En Vivo"
    private var streamUrl = ""
    private var currentAlbumArtBitmap: Bitmap? = null

    private var currentVolume = 0.8f

    private val mainHandler = Handler(Looper.getMainLooper())

    // Coroutine scope tied to the service lifecycle.
    // SupervisorJob ensures a failed bitmap download doesn't cancel other coroutines.
    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)

    private var artFetchJob: Job? = null
    
    // Nuestro procesador que lee los bytes PCM por bandas espectrales en passthrough
    val visualizerProcessor = VisualizerAudioProcessor()

    @OptIn(UnstableApi::class)
    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()

        currentVolume = getSharedPreferences("radio_prefs", Context.MODE_PRIVATE)
            .getFloat("volume", 0.8f)
            .coerceIn(0f, 1f)

        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 1. RenderersFactory con el AudioSink sobreescrito para inyectar nuestro AudioProcessor
        val renderersFactory = object : DefaultRenderersFactory(this) {
            override fun buildAudioSink(
                context: Context,
                enableFloatOutput: Boolean,
                enableAudioTrackPlaybackParams: Boolean
            ): AudioSink {
                return DefaultAudioSink.Builder(context)
                    .setEnableFloatOutput(enableFloatOutput)
                    .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
                    .setAudioProcessors(arrayOf(visualizerProcessor))
                    .build()
            }
        }.apply {
            setEnableAudioTrackPlaybackParams(false)
            setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_OFF)
        }

        // 2. Disable Audio Offload at Audio Attributes Level
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .setSpatializationBehavior(C.SPATIALIZATION_BEHAVIOR_NEVER)
            .build()

        try {
            val player = ExoPlayer.Builder(this, renderersFactory)
                .setAudioAttributes(audioAttributes, true)
                .setHandleAudioBecomingNoisy(true)
                .build().apply {
                
                // 3. Disable Audio Offload at Track Selection Level
                trackSelectionParameters = trackSelectionParameters.buildUpon()
                    .setAudioOffloadPreferences(
                        TrackSelectionParameters.AudioOffloadPreferences.Builder()
                            .setAudioOffloadMode(TrackSelectionParameters.AudioOffloadPreferences.AUDIO_OFFLOAD_MODE_DISABLED)
                            .build()
                    )
                    .build()

                volume = currentVolume
                addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        updateNotification()
                    }
                })
            }
            exoPlayer = player
            mediaSession = MediaSession.Builder(this, player)
                .setSessionActivity(openIntent)
                .build()
        } catch (e: Exception) {
            Log.w(TAG, "⚠️ ExoPlayer / MediaSession inicialización fallida: ${e.message}", e)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == null) return START_NOT_STICKY

        when (intent.action) {
            ACTION_PLAY -> {
                streamUrl = intent.getStringExtra(EXTRA_URL) ?: return START_STICKY
                currentTitle = intent.getStringExtra(EXTRA_TITLE) ?: currentTitle
                currentArtist = intent.getStringExtra(EXTRA_ARTIST) ?: currentArtist

                val albumArtUrl = intent.getStringExtra(EXTRA_ALBUM_ART) ?: ""
                if (albumArtUrl.startsWith("http://") || albumArtUrl.startsWith("https://")) {
                    fetchBitmapFromUrl(albumArtUrl)
                } else {
                    currentAlbumArtBitmap = null
                    fetchAlbumArt(currentArtist, currentTitle)
                }

                val metadata = MediaMetadata.Builder()
                    .setTitle(currentTitle)
                    .setArtist(currentArtist)
                    .setIsPlayable(true)
                    .build()
                val mediaItem = MediaItem.Builder()
                    .setUri(streamUrl)
                    .setMediaMetadata(metadata)
                    .build()
                exoPlayer?.apply {
                    setMediaItem(mediaItem)
                    prepare()
                    play()
                }
            }
            ACTION_PAUSE -> {
                exoPlayer?.pause()
            }
            ACTION_STOP -> {
                artFetchJob?.cancel()
                exoPlayer?.stop()
                exoPlayer?.clearMediaItems()
                mediaSession?.release()
                mediaSession = null
                currentAlbumArtBitmap = null
                ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE_METADATA -> {
                currentTitle = intent.getStringExtra(EXTRA_TITLE) ?: currentTitle
                currentArtist = intent.getStringExtra(EXTRA_ARTIST) ?: currentArtist

                val albumArtUrl = intent.getStringExtra(EXTRA_ALBUM_ART) ?: ""
                if (albumArtUrl.startsWith("http://") || albumArtUrl.startsWith("https://")) {
                    fetchBitmapFromUrl(albumArtUrl)
                } else {
                    currentAlbumArtBitmap = null
                    fetchAlbumArt(currentArtist, currentTitle)
                }
            }
        }
        showNotification()
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        instance = null
        serviceJob.cancel()   // Cancel all pending coroutines
        mediaSession?.release()
        mediaSession = null
        exoPlayer?.release()
        exoPlayer = null
        super.onDestroy()
    }

    fun play(url: String, title: String, artist: String) {
        streamUrl = url
        currentTitle = title
        currentArtist = artist
        val intent = Intent(this, AudioService::class.java).apply {
            action = ACTION_PLAY
            putExtra(EXTRA_URL, url)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_ARTIST, artist)
        }
        startServiceIfNeeded(intent)
        showNotification()
    }

    fun pause() {
        exoPlayer?.pause()
        val intent = Intent(this, AudioService::class.java).apply {
            action = ACTION_PAUSE
        }
        startServiceIfNeeded(intent)
    }

    fun stopPlayback() {
        val intent = Intent(this, AudioService::class.java).apply {
            action = ACTION_STOP
        }
        startServiceIfNeeded(intent)
    }

    fun updateMetadata(title: String, artist: String) {
        currentTitle = title
        currentArtist = artist
        val intent = Intent(this, AudioService::class.java).apply {
            action = ACTION_UPDATE_METADATA
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_ARTIST, artist)
        }
        startServiceIfNeeded(intent)
    }

    fun isPlaying(): Boolean = exoPlayer?.isPlaying ?: false

    fun setVolume(volume: Float) {
        currentVolume = volume.coerceIn(0f, 1f)
        getSharedPreferences("radio_prefs", Context.MODE_PRIVATE).edit()
            .putFloat("volume", currentVolume)
            .apply()
        mainHandler.post { exoPlayer?.volume = currentVolume }
    }

    fun getVolume(): Float = currentVolume

    private fun startServiceIfNeeded(intent: Intent) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "startServiceIfNeeded failed", e)
        }
    }

    private fun showNotification() {
        val notification = buildNotification(currentTitle, currentArtist)
        startForeground(NOTIFICATION_ID, notification)
    }

    private fun updateNotification() {
        val notification = buildNotification(currentTitle, currentArtist)
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Reproducción de radio",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notificación de reproducción de Sonido Celestial"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(title: String, artist: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val cancelIntent = PendingIntent.getService(
            this, 2,
            Intent(this, AudioService::class.java).apply {
                action = ACTION_STOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val playPauseAction: NotificationCompat.Action
        if (exoPlayer?.isPlaying == true) {
            val pauseIntent = PendingIntent.getService(
                this, 1,
                Intent(this, AudioService::class.java).apply { action = ACTION_PAUSE },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            playPauseAction = NotificationCompat.Action(
                android.R.drawable.ic_media_pause, "Pausar", pauseIntent
            )
        } else {
            val playIntent = PendingIntent.getService(
                this, 1,
                Intent(this, AudioService::class.java).apply {
                    action = ACTION_PLAY
                    putExtra(EXTRA_URL, streamUrl)
                    putExtra(EXTRA_TITLE, currentTitle)
                    putExtra(EXTRA_ARTIST, currentArtist)
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            playPauseAction = NotificationCompat.Action(
                android.R.drawable.ic_media_play, "Reanudar", playIntent
            )
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText("Radio Sonido Celestial")
            .setSmallIcon(R.drawable.ic_notification)
            .setLargeIcon(currentAlbumArtBitmap)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setSilent(true)
            .setColor(0xFFFCAD04.toInt())
            .addAction(playPauseAction)
            .setStyle(androidx.media.app.NotificationCompat.MediaStyle()
                .setShowActionsInCompactView(0)
                .setShowCancelButton(true)
                .setCancelButtonIntent(cancelIntent))
            .build()
    }

    private fun updateMediaSessionMetadata() {
        val metadataBuilder = MediaMetadata.Builder()
            .setTitle(currentTitle)
            .setArtist(currentArtist)
            .setIsPlayable(true)

        currentAlbumArtBitmap?.let { bitmap ->
            try {
                val baos = ByteArrayOutputStream()
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, baos)
                val byteArray = baos.toByteArray()
                metadataBuilder.setArtworkData(byteArray, MediaMetadata.PICTURE_TYPE_FRONT_COVER)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to compress bitmap for media metadata", e)
            }
        }

        val metadata = metadataBuilder.build()
        exoPlayer?.let { player ->
            player.playlistMetadata = metadata
        }
    }

    private fun decodeSampledBitmapFromStream(inputStream: InputStream, reqWidth: Int = 512, reqHeight: Int = 512): Bitmap? {
        return try {
            val bytes = inputStream.readBytes()
            val options = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)

            var inSampleSize = 1
            val height: Int = options.outHeight
            val width: Int = options.outWidth
            if (height > reqHeight || width > reqWidth) {
                val halfHeight = height / 2
                val halfWidth = width / 2
                while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                    inSampleSize *= 2
                }
            }

            options.inSampleSize = inSampleSize
            options.inJustDecodeBounds = false
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Downloads an album art bitmap from [artUrl] on an IO coroutine and updates
     * the notification on the Main thread once complete.
     * Any previous pending fetch is cancelled before starting a new one.
     */
    private fun fetchBitmapFromUrl(artUrl: String) {
        if (artUrl.isEmpty()) return
        artFetchJob?.cancel()
        artFetchJob = serviceScope.launch {
            var conn: HttpURLConnection? = null
            try {
                val url = URL(artUrl)
                conn = url.openConnection() as? HttpURLConnection
                conn?.apply {
                    connectTimeout = 5000
                    readTimeout = 5000
                }
                val bitmap = conn?.inputStream?.let { decodeSampledBitmapFromStream(it, 512, 512) }
                if (bitmap != null) {
                    withContext(Dispatchers.Main) {
                        currentAlbumArtBitmap = bitmap
                        updateNotification()
                        updateMediaSessionMetadata()
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "fetchBitmapFromUrl failed for $artUrl", e)
            } finally {
                conn?.disconnect()
            }
        }
    }

    private fun cleanTerm(text: String): String {
        return text
            .replace(Regex("\\s*[(\\[].*?[)\\]]"), "")
            .replace(Regex("ft\\..*|feat\\..*", RegexOption.IGNORE_CASE), "")
            .replace(Regex("[-_]"), " ")
            .trim()
    }

    private fun searchItunesUrl(term: String): String? {
        if (term.isBlank()) return null
        var conn: HttpURLConnection? = null
        return try {
            val query = URLEncoder.encode(term, "UTF-8")
            val url = URL("https://itunes.apple.com/search?term=$query&media=music&limit=1")
            conn = url.openConnection() as? HttpURLConnection
            conn?.apply {
                connectTimeout = 5000
                readTimeout = 5000
            }
            val json = conn?.inputStream?.bufferedReader()?.readText() ?: return null
            val results = JSONObject(json).getJSONArray("results")
            if (results.length() > 0) {
                results.getJSONObject(0)
                    .getString("artworkUrl100")
                    .replace("100x100", "600x600")
            } else null
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    /**
     * Queries the iTunes Search API to find album art for the given [artist] and [title],
     * then delegates to [fetchBitmapFromUrl] with the resolved image URL.
     */
    private fun fetchAlbumArt(artist: String, title: String) {
        if (artist == "Radio Sonido Celestial" || title == "En Vivo" || title.isEmpty()) return
        artFetchJob?.cancel()
        artFetchJob = serviceScope.launch {
            val cleanArtist = cleanTerm(artist)
            val cleanTitle = cleanTerm(title)

            var artUrl = searchItunesUrl("$cleanArtist $cleanTitle")
            if (artUrl == null && cleanTitle.isNotEmpty() && cleanTitle != cleanArtist) {
                artUrl = searchItunesUrl(cleanTitle)
            }
            if (artUrl == null && cleanArtist.isNotEmpty()) {
                artUrl = searchItunesUrl(cleanArtist)
            }

            if (!artUrl.isNullOrEmpty()) {
                fetchBitmapFromUrl(artUrl)
            }
        }
    }
}
