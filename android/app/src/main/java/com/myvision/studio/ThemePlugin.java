package com.myvision.studio;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Theme")
public class ThemePlugin extends Plugin {
    @PluginMethod
    public void setPreferences(PluginCall call) {
        String theme = call.getString("theme", "dark");
        boolean splashAnimation = call.getBoolean("splashAnimation", true);
        SharedPreferences preferences = getContext().getSharedPreferences("myvision_preferences", Context.MODE_PRIVATE);
        preferences.edit().putString("theme", theme).putBoolean("splashAnimation", splashAnimation).apply();
        if (getActivity() instanceof MainActivity) {
            getActivity().runOnUiThread(() -> ((MainActivity) getActivity()).applyAppearance());
        }
        call.resolve();
    }

    @PluginMethod
    public void getDynamicColor(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            int color = getContext().getColor(android.R.color.system_accent1_600);
            result.put("color", String.format("#%06X", 0xFFFFFF & color));
        }
        call.resolve(result);
    }
}
