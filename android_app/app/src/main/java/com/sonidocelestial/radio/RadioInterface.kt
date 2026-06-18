package com.sonidocelestial.radio

import android.content.Context
import android.content.Intent
import android.os.Build
import android.webkit.JavascriptInterface

class RadioInterface(private val context: Context) {

    @JvmOverloads
    @JavascriptInterface
    fun play(url: String, title: String, artist: String, albumArt: String = "") {
        val intent = Intent(context, AudioService::class.java).apply {
            action = AudioService.ACTION_PLAY
            putExtra(AudioService.EXTRA_URL, url)
            putExtra(AudioService.EXTRA_TITLE, title)
            putExtra(AudioService.EXTRA_ARTIST, artist)
            putExtra(AudioService.EXTRA_ALBUM_ART, albumArt)
        }
        startServiceSafely(intent)
    }

    @JavascriptInterface
    fun pause() {
        val intent = Intent(context, AudioService::class.java).apply {
            action = AudioService.ACTION_PAUSE
        }
        startServiceSafely(intent)
    }

    @JavascriptInterface
    fun setVolume(volume: Double) {
        AudioService.instance?.setVolume(volume.toFloat())
    }

    @JavascriptInterface
    fun getVolume(): Double {
        return AudioService.instance?.getVolume()?.toDouble() ?: 0.8
    }

    @JvmOverloads
    @JavascriptInterface
    fun updateMetadata(title: String, artist: String, albumArt: String = "") {
        val intent = Intent(context, AudioService::class.java).apply {
            action = AudioService.ACTION_UPDATE_METADATA
            putExtra(AudioService.EXTRA_TITLE, title)
            putExtra(AudioService.EXTRA_ARTIST, artist)
            putExtra(AudioService.EXTRA_ALBUM_ART, albumArt)
        }
        startServiceSafely(intent)
    }

    private fun startServiceSafely(intent: Intent) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (_: Exception) {
        }
    }
}
