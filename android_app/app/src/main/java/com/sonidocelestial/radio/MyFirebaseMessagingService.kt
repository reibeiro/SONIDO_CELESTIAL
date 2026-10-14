package com.sonidocelestial.radio

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "FCM_Service"
        const val CHANNEL_ID = "radio_events_channel"
        const val TOPIC_ALL = "all_listeners"

        fun subscribeToEventsTopic() {
            try {
                FirebaseMessaging.getInstance().subscribeToTopic(TOPIC_ALL)
                    .addOnCompleteListener { task ->
                        if (task.isSuccessful) {
                            Log.d(TAG, "Subscribed to FCM topic: $TOPIC_ALL")
                        } else {
                            Log.w(TAG, "FCM subscription failed", task.exception)
                        }
                    }
            } catch (e: Exception) {
                Log.w(TAG, "FirebaseMessaging not initialized yet", e)
            }
        }

        fun showStaticPushNotification(context: Context, title: String, message: String, imageUrl: String? = null, targetTab: String? = null) {
            createNotificationChannel(context)

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("from_push", true)
                if (!targetTab.isNullOrEmpty()) {
                    putExtra("target_tab", targetTab)
                }
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                System.currentTimeMillis().toInt(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(message)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setColor(0xFFFCAD04.toInt())
                .setPriority(NotificationCompat.PRIORITY_HIGH)

            val manager = context.getSystemService(NOTIFICATION_SERVICE) as? NotificationManager
            manager?.notify(System.currentTimeMillis().toInt(), builder.build())
        }

        fun createNotificationChannel(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Avisos y Eventos en Vivo",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Notificaciones push sobre emisiones de video en vivo, vigilias y oración."
                    enableVibration(true)
                }
                val manager = context.getSystemService(NOTIFICATION_SERVICE) as? NotificationManager
                manager?.createNotificationChannel(channel)
            }
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "Refreshed FCM registration token: $token")
        subscribeToEventsTopic()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "FCM Message received from: ${remoteMessage.from}")

        val title = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "Radio Sonido Celestial"

        val body = remoteMessage.notification?.body
            ?: remoteMessage.data["body"]
            ?: "¡Hay un evento en vivo disponible!"

        val imageUrl = remoteMessage.notification?.imageUrl?.toString()
            ?: remoteMessage.data["imageUrl"]
            ?: remoteMessage.data["image"]

        val targetTab = remoteMessage.data["target_tab"]
            ?: if (title.contains("Versículo", ignoreCase = true) || remoteMessage.data["type"] == "verse") "bible" else null

        showPushNotification(title, body, imageUrl, targetTab)
    }

    private fun showPushNotification(title: String, message: String, imageUrl: String?, targetTab: String? = null) {
        createNotificationChannel()

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("from_push", true)
            if (!targetTab.isNullOrEmpty()) {
                putExtra("target_tab", targetTab)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            101,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(message)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setColor(0xFFFCAD04.toInt())
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        if (!imageUrl.isNullOrEmpty()) {
            val bitmap = fetchBitmapFromUrl(imageUrl)
            if (bitmap != null) {
                builder.setLargeIcon(bitmap)
                builder.setStyle(NotificationCompat.BigPictureStyle().bigPicture(bitmap))
            }
        }

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        manager?.notify(System.currentTimeMillis().toInt(), builder.build())
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Avisos y Eventos en Vivo",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notificaciones push sobre emisiones de video en vivo, vigilias y oración."
                enableVibration(true)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
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

    private fun fetchBitmapFromUrl(urlString: String): Bitmap? {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL(urlString)
            conn = url.openConnection() as? HttpURLConnection
            conn?.apply {
                connectTimeout = 5000
                readTimeout = 5000
            }
            conn?.inputStream?.let { decodeSampledBitmapFromStream(it, 512, 512) }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to download push image from $urlString", e)
            null
        } finally {
            conn?.disconnect()
        }
    }
}
