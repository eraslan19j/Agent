package com.myvision.studio;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
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

/** Native theme/splash bootstrap and reliable notch/system-bar insets. */
public class MainActivity extends BridgeActivity {
    private View webView;

    private boolean isLightTheme() {
        SharedPreferences preferences = getSharedPreferences("myvision_preferences", Context.MODE_PRIVATE);
        String theme = preferences.getString("theme", "dark");
        if ("light".equals(theme)) return true;
        if ("system".equals(theme)) {
            return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) != Configuration.UI_MODE_NIGHT_YES;
        }
        return false;
    }

    private int launchTheme() {
        SharedPreferences preferences = getSharedPreferences("myvision_preferences", Context.MODE_PRIVATE);
        String theme = preferences.getString("theme", "dark");
        if ("light".equals(theme)) return R.style.AppTheme_NoActionBarLaunch_Light;
        if ("amoled".equals(theme)) return R.style.AppTheme_NoActionBarLaunch_Amoled;
        if ("system".equals(theme) && isLightTheme()) return R.style.AppTheme_NoActionBarLaunch_Light;
        return R.style.AppTheme_NoActionBarLaunch;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        setTheme(launchTheme());
        registerPlugin(ThemePlugin.class);
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams layoutParams = window.getAttributes();
            layoutParams.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(layoutParams);
        }

        webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets safeArea = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
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
        applyAppearance();
        ViewCompat.requestApplyInsets(webView);
    }

    public void applyAppearance() {
        boolean light = isLightTheme();
        SharedPreferences preferences = getSharedPreferences("myvision_preferences", Context.MODE_PRIVATE);
        String theme = preferences.getString("theme", "dark");
        int background = light ? Color.rgb(245, 245, 247) : ("amoled".equals(theme) ? Color.BLACK : Color.BLACK);
        Window window = getWindow();
        window.setStatusBarColor(background);
        window.setNavigationBarColor(background);
        window.getDecorView().setBackgroundColor(background);
        WindowCompat.getInsetsController(window, window.getDecorView()).setAppearanceLightStatusBars(light);
        WindowCompat.getInsetsController(window, window.getDecorView()).setAppearanceLightNavigationBars(light);
        if (webView != null) webView.setBackgroundColor(background);
    }

    @Override
    public void onResume() {
        super.onResume();
        applyAppearance();
        if (webView != null) {
            webView.post(() -> {
                ViewCompat.requestApplyInsets(webView);
                webView.requestLayout();
            });
        }
    }
}
