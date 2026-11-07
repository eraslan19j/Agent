package com.myvision.studio;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Keeps the WebView below notches/system bars on Android, including Huawei/HarmonyOS.
 * Margins are applied natively because safe-area-inset-* is not reliable in every WebView.
 */
public class MainActivity extends BridgeActivity {
    private View webView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        int background = Color.rgb(11, 11, 13);
        window.setStatusBarColor(background);
        window.setNavigationBarColor(background);
        window.getDecorView().setBackgroundColor(background);
        WindowCompat.getInsetsController(window, window.getDecorView()).setAppearanceLightStatusBars(false);
        WindowCompat.getInsetsController(window, window.getDecorView()).setAppearanceLightNavigationBars(false);
        WindowCompat.setDecorFitsSystemWindows(window, false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams layoutParams = window.getAttributes();
            layoutParams.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(layoutParams);
        }

        webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets safeArea = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            ViewGroup.LayoutParams currentParams = view.getLayoutParams();
            if (currentParams instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) currentParams;
                if (params.topMargin != safeArea.top || params.bottomMargin != safeArea.bottom
                        || params.leftMargin != safeArea.left || params.rightMargin != safeArea.right) {
                    params.topMargin = safeArea.top;
                    params.bottomMargin = safeArea.bottom;
                    params.leftMargin = safeArea.left;
                    params.rightMargin = safeArea.right;
                    view.setLayoutParams(params);
                    view.requestLayout();
                }
            }
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (webView != null) {
            webView.post(() -> {
                ViewCompat.requestApplyInsets(webView);
                webView.requestLayout();
            });
        }
    }
}
