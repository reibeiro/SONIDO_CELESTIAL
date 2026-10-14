package com.sonidocelestial.radio

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query

import android.widget.ImageView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.material.color.DynamicColors

class MainActivity : AppCompatActivity() {

    private lateinit var myWebView: WebView
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getSharedPreferences("radio_prefs", MODE_PRIVATE).edit()
                .putBoolean("notification_permission_denied", true)
                .apply()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        DynamicColors.applyToActivityIfAvailable(this)
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        WindowCompat.setDecorFitsSystemWindows(window, false)

        val splashOverlay = findViewById<View>(R.id.splash_overlay)
        val splashLogo = findViewById<ImageView>(R.id.splash_logo)
        val splashVersion = findViewById<TextView>(R.id.splash_version)

        splashVersion.text = try {
            "Versión ${packageManager.getPackageInfo(packageName, 0).versionName}"
        } catch (_: Exception) {
            "Versión 1.0"
        }

        myWebView = findViewById(R.id.webview)

        ViewCompat.setOnApplyWindowInsetsListener(myWebView) { v, insets ->
            val statusBar = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            val navBar = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            v.setPadding(0, statusBar.top, 0, navBar.bottom)
            insets
        }
        val webSettings = myWebView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.mediaPlaybackRequiresUserGesture = false
        webSettings.allowFileAccess = true
        webSettings.allowContentAccess = true
        @Suppress("DEPRECATION")
        webSettings.allowFileAccessFromFileURLs = true
        @Suppress("DEPRECATION")
        webSettings.allowUniversalAccessFromFileURLs = true
        webSettings.javaScriptCanOpenWindowsAutomatically = false

        myWebView.webViewClient = MyWebViewClient()
        myWebView.webChromeClient = MyWebChromeClient()
        myWebView.addJavascriptInterface(RadioInterface(this), "Android")
        myWebView.loadUrl("file:///android_asset/index.html")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                MyFirebaseMessagingService.subscribeToEventsTopic()
            }
        } else {
            MyFirebaseMessagingService.subscribeToEventsTopic()
        }

        // Native Firestore Realtime Push Notification Listener
        try {
            var isInitialLoad = true
            FirebaseFirestore.getInstance()
                .collection("notification_requests")
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .limit(1)
                .addSnapshotListener { snapshot, _ ->
                    if (isInitialLoad) {
                        isInitialLoad = false
                        return@addSnapshotListener
                    }
                    snapshot?.documentChanges?.forEach { change ->
                        if (change.type == DocumentChange.Type.ADDED) {
                            val data = change.document.data
                            val title = data["title"]?.toString() ?: "Radio Sonido Celestial"
                            val body = data["body"]?.toString() ?: "¡Hay un evento en vivo disponible!"
                            val img = data["imageUrl"]?.toString()
                            val type = data["type"]?.toString()
                            val targetTab = if (type == "verse" || title.contains("Versículo", ignoreCase = true)) "bible" else null
                            MyFirebaseMessagingService.showStaticPushNotification(this, title, body, img, targetTab)
                        }
                    }
                }
        } catch (e: Exception) {
            Log.w("MainActivity", "Firestore push listener error", e)
        }

        handlePushTargetTab(intent)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (myWebView.canGoBack()) {
                    myWebView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        // --- Splash animation ---
        splashLogo.alpha = 0f
        splashLogo.animate()
            .alpha(1f)
            .setDuration(600)
            .setInterpolator(AccelerateDecelerateInterpolator())
            .start()

        Handler(Looper.getMainLooper()).postDelayed({
            splashOverlay.animate()
                .alpha(0f)
                .setDuration(500)
                .setInterpolator(AccelerateDecelerateInterpolator())
                .withEndAction { splashOverlay.visibility = View.GONE }
                .start()
        }, 2200)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handlePushTargetTab(intent)
    }

    private fun handlePushTargetTab(intent: Intent?) {
        val targetTab = intent?.getStringExtra("target_tab")
        if (targetTab == "bible") {
            Handler(Looper.getMainLooper()).postDelayed({
                myWebView.evaluateJavascript("if(window.openBibleSection) window.openBibleSection();", null)
            }, 800)
        }
    }

    private inner class MyWebChromeClient : WebChromeClient() {
        override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
            if (customView != null) {
                onHideCustomView()
                return
            }
            customView = view
            customViewCallback = callback
            (window.decorView as android.view.ViewGroup).addView(
                customView,
                android.view.ViewGroup.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT
                )
            )
            myWebView.visibility = View.GONE
        }

        override fun onHideCustomView() {
            if (customView == null) return
            (window.decorView as android.view.ViewGroup).removeView(customView)
            customView = null
            myWebView.visibility = View.VISIBLE
            customViewCallback?.onCustomViewHidden()
        }

        override fun onPermissionRequest(request: PermissionRequest?) {
            runOnUiThread {
                request?.grant(request.resources)
            }
        }
    }

    @Suppress("DEPRECATION")
    private inner class MyWebViewClient : WebViewClient() {
        override fun onPageFinished(view: WebView?, url: String?) {
            super.onPageFinished(view, url)
            handlePushTargetTab(intent)
        }

        @Suppress("DEPRECATION")
        override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: android.net.http.SslError?) {
            handler?.cancel()
        }

        @Suppress("DEPRECATION")
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url.toString()

            // Intercept YouTube, Facebook, WhatsApp, Intent schemes, and open in external native apps
            if (url.contains("youtube.com") || url.contains("youtu.be") ||
                url.contains("facebook.com") || url.contains("fb.watch") || url.startsWith("fb://") ||
                url.contains("wa.me") || url.contains("privacy-policy") ||
                url.startsWith("intent://") || url.startsWith("vnd.youtube:")
            ) {
                return try {
                    val intent = if (url.startsWith("intent://")) {
                        Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                    } else {
                        Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    }
                    startActivity(intent)
                    true
                } catch (_: Exception) {
                    false
                }
            }

            if (url.startsWith("http://") || url.startsWith("https://")) {
                return false
            }

            return try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
                true
            } catch (_: Exception) {
                true
            }
        }
    }
}
