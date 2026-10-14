package com.sonidocelestial.radio

import androidx.annotation.OptIn
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.min

@OptIn(UnstableApi::class)
class VisualizerAudioProcessor : BaseAudioProcessor() {

    companion object {
        private const val BANDS = 32
        // Arreglo volátil de bandas normalizadas (0.0 a 1.0)
        @Volatile
        var bandsData: FloatArray = FloatArray(BANDS)
    }

    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        return inputAudioFormat
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val remaining = inputBuffer.remaining()
        if (remaining == 0) return

        val dup = inputBuffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
        val totalSamples = dup.remaining() / 2 // 16-bit PCM

        if (totalSamples >= BANDS) {
            val samplesPerBand = totalSamples / BANDS
            val newBands = FloatArray(BANDS)

            for (i in 0 until BANDS) {
                var bandPeak = 0
                for (j in 0 until samplesPerBand) {
                    if (dup.remaining() >= 2) {
                        val sample = abs(dup.short.toInt())
                        if (sample > bandPeak) {
                            bandPeak = sample
                        }
                    }
                }
                // Normalizar de 0.0 a 1.0 (El máximo absoluto de Short es 32767)
                newBands[i] = min(1.0f, bandPeak / 32767f)
            }
            bandsData = newBands
        }

        // Pasar audio sin alteraciones al altavoz (passthrough transparente)
        val output = replaceOutputBuffer(remaining)
        output.put(inputBuffer)
        output.flip()
    }
}
