# WebView is used to load local HTML content
-keepclassmembers class * extends android.webkit.WebView {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
}
-keepclassmembers class * extends android.webkit.WebViewClient {
    public <init>();
}
-keep class com.sonidocelestial.radio.** { *; }

# Media3 / ExoPlayer
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**
-keep class com.google.android.exoplayer2.** { *; }
-dontwarn com.google.android.exoplayer2.**

# Keep @JavascriptInterface methods (redundant with class keep, but explicit)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Kotlin coroutines spilling (required by R8)
-dontwarn kotlin.coroutines.jvm.internal.SpillingKt
