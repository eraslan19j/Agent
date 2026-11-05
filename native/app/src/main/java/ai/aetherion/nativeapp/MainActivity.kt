package ai.aetherion.nativeapp

import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var game: GameSurfaceView
    private lateinit var hud: HudView
    private lateinit var menuRoot: View
    private lateinit var hudTop: View
    private lateinit var winRoot: View
    private lateinit var coinText: TextView
    private lateinit var timeText: TextView
    private lateinit var diagText: TextView
    private lateinit var winTime: TextView

    private var playing = false
    private var winShown = false
    private var lastCoins = -1
    private var lastPost = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)

        game = findViewById(R.id.game)
        hud = findViewById(R.id.hud)
        menuRoot = findViewById(R.id.menuRoot)
        hudTop = findViewById(R.id.hudTop)
        winRoot = findViewById(R.id.winRoot)
        coinText = findViewById(R.id.coinText)
        timeText = findViewById(R.id.timeText)
        diagText = findViewById(R.id.diagText)
        winTime = findViewById(R.id.winTime)

        findViewById<View>(R.id.playBtn).setOnClickListener { startGame() }
        findViewById<View>(R.id.againBtn).setOnClickListener { startGame() }
        findViewById<View>(R.id.menuBtn).setOnClickListener { backToMenu() }
        findViewById<View>(R.id.leaveBtn).setOnClickListener { backToMenu() }

        hud.onMove = { x, y -> Engine.setMove(x, y) }
        hud.onJump = { Engine.jump() }

        game.onState = { s -> onState(s) }

        hideSystemBars()
        showMenu()
    }

    // ------------------------------------------------------------------ screens
    private fun showMenu() {
        playing = false
        winShown = false
        game.paused = true
        hud.releaseStick()
        hud.visibility = View.GONE
        hudTop.visibility = View.GONE
        winRoot.visibility = View.GONE
        menuRoot.visibility = View.VISIBLE
        updateDiag()
    }

    private fun startGame() {
        Engine.reset()
        Engine.setMove(0f, 0f)
        playing = true
        winShown = false
        lastCoins = -1
        lastPost = 0L
        game.paused = false
        menuRoot.visibility = View.GONE
        winRoot.visibility = View.GONE
        hud.visibility = View.VISIBLE
        hudTop.visibility = View.VISIBLE
        hud.refreshLayout()
        coinText.text = "0/20"
        timeText.text = "00:00"
    }

    private fun backToMenu() {
        showMenu()
    }

    // ------------------------------------------------------------------ game HUD
    private fun onState(s: FloatArray) {
        if (s.size < 10) return
        val coins = s[Engine.S_COINS].toInt()
        val total = s[Engine.S_TOTAL].toInt()
        val t = s[Engine.S_TIME]
        val won = s[Engine.S_WON] > 0.5f
        val now = System.currentTimeMillis()
        if (coins == lastCoins && now - lastPost < 120 && !won) return
        lastPost = now
        lastCoins = coins

        val coinLabel = String.format(Locale.US, "%d/%d", coins, total)
        val timeLabel = String.format(
            Locale.US, "%02d:%02d", (t / 60f).toInt(), (t % 60f).toInt()
        )
        runOnUiThread {
            if (!playing) return@runOnUiThread
            coinText.text = coinLabel
            timeText.text = timeLabel
            if (won && !winShown) {
                winShown = true
                winTime.text = String.format(Locale.US, "Süre: %s", timeLabel)
                winRoot.visibility = View.VISIBLE
                hud.visibility = View.GONE
                hudTop.visibility = View.GONE
                hud.releaseStick()
                game.paused = true
            }
        }
    }

    /** Shown on the title screen when the engine could not start. */
    private fun updateDiag() {
        val msg = when {
            !Engine.loaded -> "motor yüklenemedi: ${Engine.loadError}"
            !Engine.ready() -> {
                val err = Engine.lastError()
                if (err.isNotBlank()) err.take(300) else "motor henüz hazır değil"
            }
            else -> ""
        }
        diagText.text = msg
        diagText.visibility = if (msg.isEmpty()) View.GONE else View.VISIBLE
    }

    // ------------------------------------------------------------------ lifecycle
    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onResume() {
        super.onResume()
        game.onResume()
        hideSystemBars()
        if (!playing) game.paused = true
    }

    override fun onPause() {
        super.onPause()
        hud.releaseStick()
        game.onPause()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (playing) {
            backToMenu()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }
}
