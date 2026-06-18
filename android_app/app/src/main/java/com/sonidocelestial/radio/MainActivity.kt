package com.sonidocelestial.radio

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.webkit.SslErrorHandler
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

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
        webSettings.allowFileAccess = false
        webSettings.allowContentAccess = false
        // allowFileAccessFromFileURLs is deprecated and false by default on API 16+
        webSettings.javaScriptCanOpenWindowsAutomatically = false

        myWebView.webViewClient = MyWebViewClient()
        myWebView.addJavascriptInterface(RadioInterface(this), "Android")
        myWebView.loadUrl("file:///android_asset/index.html")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

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

    @Suppress("DEPRECATION")
    private inner class MyWebViewClient : WebViewClient() {
        @Suppress("DEPRECATION")
        override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: android.net.http.SslError?) {
            handler?.cancel()
        }

        @Suppress("DEPRECATION")
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url.toString()

            if (url.startsWith("http://") || url.startsWith("https://")) {
                return false
            }

            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            val pm = packageManager
            if (pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY).isEmpty()) {
                return true
            }
            return try {
                startActivity(intent)
                true
            } catch (e: Exception) {
                true
            }
        }
    }
}
