package com.myvision.studio;

import android.content.Context;
import android.content.SharedPreferences;

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

}
