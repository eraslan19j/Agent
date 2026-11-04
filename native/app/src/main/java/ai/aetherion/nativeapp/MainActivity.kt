package ai.aetherion.nativeapp

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    private lateinit var game: GameSurfaceView
    private lateinit var hud: HudView
    private lateinit var menuRoot: View
    private lateinit var screenMenu: View
    private lateinit var screenChars: View
    private lateinit var cardRow: LinearLayout
    private lateinit var pauseRoot: View
    private lateinit var gpuInfo: TextView
    private lateinit var titleMain: TextView

    private val elementColors = intArrayOf(
        Color.parseColor("#6FE8C4"),
        Color.parseColor("#FF8A3D"),
        Color.parseColor("#B06FFF"),
        Color.parseColor("#8CD8FF"),
    )
    private val elementNames = arrayOf("ANEMO", "PYRO", "ELECTRO", "CRYO")
    private val characterNames = arrayOf("KAEL", "SERA", "RIN", "BORA")
    private val characterRole = arrayOf("Kılıç · Rüzgâr", "Katalizör · Ateş", "Mızrak · Yıldırım", "Çift Eli · Buz")
    private val characterLine = arrayOf(
        "Sessiz vadinin gözcüsü. Rüzgârı kılıcına dolayan ilk mühür.",
        "Ateşin sesini duyan kâhin. Bir bakışta kül, bir bakışta kor.",
        "Yıldırımın peşinde koşan avcı. Mızrağı gökyüzünü çizer.",
        "Buzun ağırlığını taşıyan bekçi. Her adımı bir çığ.",
    )

    private var selectedChar = 0
    private val cards = ArrayList<View>()
    private val glows = ArrayList<View>()

    private lateinit var prefs: android.content.SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("aetherion", Context.MODE_PRIVATE)

        game = findViewById(R.id.game)
        hud = findViewById(R.id.hud)
        menuRoot = findViewById(R.id.menuRoot)
        screenMenu = findViewById(R.id.screenMenu)
        screenChars = findViewById(R.id.screenChars)
        cardRow = findViewById(R.id.cardRow)
        pauseRoot = findViewById(R.id.pauseRoot)
        gpuInfo = findViewById(R.id.gpuInfo)
        titleMain = findViewById(R.id.titleMain)

        menuRoot.isClickable = true
        pauseRoot.isClickable = true

        hideSystemBars()
        buildCards()
        wireHud()
        wireMenu()
        wireSettings()
        applySettings()
        introAnimation()
    }

    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    // ------------------------------------------------------------- character select
    private fun dp(v: Float) = v * resources.displayMetrics.density

    private fun buildCards() {
        cardRow.removeAllViews()
        cards.clear()
        glows.clear()
        val w = dp(178f)
        for (i in 0 until 4) {
            val holder = FrameLayout(this)
            val lp = LinearLayout.LayoutParams(w.toInt(), ViewGroup.LayoutParams.MATCH_PARENT)
            lp.marginStart = (dp(11f)).toInt()
            lp.marginEnd = (dp(11f)).toInt()
            lp.topMargin = (dp(10f)).toInt()
            lp.bottomMargin = (dp(14f)).toInt()
            holder.layoutParams = lp

            // base card
            val card = LinearLayout(this)
            card.orientation = LinearLayout.VERTICAL
            card.gravity = Gravity.CENTER_HORIZONTAL
            card.background = tinted(GradientDrawable().apply {
                cornerRadius = dp(18f)
                setColor(Color.parseColor("#12181F26"))
                setStroke(dp(1.2f).toInt(), Color.parseColor("#55FFFFFF"))
            })
            card.setPadding(dp(12f).toInt(), dp(18f).toInt(), dp(12f).toInt(), dp(14f).toInt())
            holder.addView(card, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

            // element aura behind the card
            val glow = View(this)
            glow.background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(
                withAlpha(elementColors[i], 90), withAlpha(elementColors[i], 0)))
            glow.alpha = 0f
            holder.addView(glow, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

            val glyph = TextView(this).apply {
                text = "◈"
                textSize = 40f
                setTextColor(elementColors[i])
                gravity = Gravity.CENTER
            }
            card.addView(glyph)

            val name = TextView(this).apply {
                text = characterNames[i]
                textSize = 22f
                typeface = Typeface.create("serif", Typeface.BOLD)
                setTextColor(Color.parseColor("#F7EEDC"))
                letterSpacing = 0.08f
                gravity = Gravity.CENTER
                setPadding(0, dp(10f).toInt(), 0, 0)
            }
            card.addView(name)

            val element = TextView(this).apply {
                text = elementNames[i]
                textSize = 9f
                letterSpacing = 0.3f
                setTextColor(elementColors[i])
                gravity = Gravity.CENTER
                setPadding(0, dp(4f).toInt(), 0, 0)
            }
            card.addView(element)

            val divider = View(this)
            divider.setBackgroundColor(withAlpha(elementColors[i], 120))
            val dlp = LinearLayout.LayoutParams(dp(36f).toInt(), dp(1.5f).toInt())
            dlp.topMargin = (dp(12f)).toInt()
            card.addView(divider, dlp)

            val role = TextView(this).apply {
                text = characterRole[i]
                textSize = 10f
                setTextColor(Color.parseColor("#AAC9D4E3"))
                gravity = Gravity.CENTER
                setPadding(0, dp(12f).toInt(), 0, 0)
            }
            card.addView(role)

            val line = TextView(this).apply {
                text = characterLine[i]
                textSize = 9f
                setTextColor(Color.parseColor("#77C9D4E3"))
                gravity = Gravity.CENTER
                maxLines = 4
                setLineSpacing(dp(2f), 1f)
                setPadding(dp(2f).toInt(), dp(10f).toInt(), dp(2f).toInt(), 0)
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
            }
            card.addView(line)

            val sel = TextView(this).apply {
                text = "SEÇİLİ"
                textSize = 8f
                letterSpacing = 0.2f
                gravity = Gravity.CENTER
                setTextColor(Color.parseColor("#1A1206"))
                background = GradientDrawable().apply {
                    cornerRadius = dp(8f)
                    setColor(elementColors[i])
                }
                setPadding(dp(8f).toInt(), dp(4f).toInt(), dp(8f).toInt(), dp(4f).toInt())
            }
            card.addView(sel)

            val idx = i
            holder.setOnClickListener { selectCharacter(idx) }
            cards.add(holder)
            glows.add(glow)
            cardRow.addView(holder)
        }
        selectCharacter(0, animate = false)
    }

    private fun tinted(d: GradientDrawable): GradientDrawable = d

    private fun withAlpha(color: Int, alpha: Int): Int =
        Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color))

    private fun selectCharacter(index: Int, animate: Boolean = true) {
        selectedChar = index
        for (i in cards.indices) {
            val isSel = i == index
            val targetScale = if (isSel) 1.055f else 0.94f
            val targetTrans = if (isSel) 0f else dp(16f)
            if (animate) {
                cards[i].animate().scaleX(targetScale).scaleY(targetScale)
                    .translationY(-targetTrans).alpha(if (isSel) 1f else 0.7f)
                    .setDuration(220).start()
                glows[i].animate().alpha(if (isSel) 1f else 0f).setDuration(260).start()
            } else {
                cards[i].scaleX = targetScale
                cards[i].scaleY = targetScale
                cards[i].translationY = -targetTrans
                cards[i].alpha = if (isSel) 1f else 0.7f
                glows[i].alpha = if (isSel) 1f else 0f
            }
            if (isSel) {
                pulse(glows[i], 0.55f, 1f)
            }
        }
        Engine.setCharacter(index)
    }

    private fun pulse(view: View, from: Float, to: Float) {
        val anim = ObjectAnimator.ofFloat(view, "alpha", from, to)
        anim.duration = 1400
        anim.repeatMode = ValueAnimator.REVERSE
        anim.repeatCount = ValueAnimator.INFINITE
        anim.start()
    }

    // ------------------------------------------------------------- hud wiring
    private fun wireHud() {
        hud.onMove = { x, y -> Engine.setMove(x, y) }
        hud.onSprint = { on -> Engine.setSprint(on) }
        hud.onAction = { code -> Engine.action(code) }
        hud.onCharacter = { idx -> selectCharacter(idx) }
        hud.onPause = { showPause(true) }
        game.onFrame = { state -> runOnUiThread { if (hud.visibility == View.VISIBLE) hud.update(state) } }
    }

    private fun wireMenu() {
        findViewById<View>(R.id.btnNew).setOnClickListener { showCharacterSelect() }
        findViewById<View>(R.id.btnChars).setOnClickListener { showCharacterSelect() }
        findViewById<View>(R.id.btnSettings).setOnClickListener { showPause(true) }
        findViewById<View>(R.id.btnBack).setOnClickListener {
            screenChars.visibility = View.GONE
            screenMenu.visibility = View.VISIBLE
        }
        findViewById<View>(R.id.btnStart).setOnClickListener { startGame() }
        findViewById<View>(R.id.btnResume).setOnClickListener { showPause(false) }
        findViewById<View>(R.id.btnQuit).setOnClickListener {
            showPause(false)
            backToMenu()
        }
    }

    private fun wireSettings() {
        val brightness = findViewById<SeekBar>(R.id.sliderBrightness)
        val sensitivity = findViewById<SeekBar>(R.id.sliderSensitivity)
        val joySide = findViewById<Switch>(R.id.switchJoySide)
        brightness.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar?, progress: Int, fromUser: Boolean) {
                Engine.setBrightness(progress / 100f)
                prefs.edit().putInt("brightness", progress).apply()
            }
            override fun onStartTrackingTouch(sb: SeekBar?) {}
            override fun onStopTrackingTouch(sb: SeekBar?) {}
        })
        sensitivity.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar?, progress: Int, fromUser: Boolean) {
                game.setLookSensitivity(progress / 100f)
                prefs.edit().putInt("sensitivity", progress).apply()
            }
            override fun onStartTrackingTouch(sb: SeekBar?) {}
            override fun onStopTrackingTouch(sb: SeekBar?) {}
        })
        joySide.setOnCheckedChangeListener { _, checked ->
            hud.applyJoystickSide(checked)
            prefs.edit().putBoolean("joyRight", checked).apply()
        }
    }

    private fun applySettings() {
        val brightness = prefs.getInt("brightness", 100)
        val sensitivity = prefs.getInt("sensitivity", 100)
        val joyRight = prefs.getBoolean("joyRight", false)
        findViewById<SeekBar>(R.id.sliderBrightness).progress = brightness
        findViewById<SeekBar>(R.id.sliderSensitivity).progress = sensitivity
        findViewById<Switch>(R.id.switchJoySide).isChecked = joyRight
        Engine.setBrightness(brightness / 100f)
        game.setLookSensitivity(sensitivity / 100f)
        hud.applyJoystickSide(joyRight)
    }

    // ------------------------------------------------------------- flow
    private fun introAnimation() {
        titleMain.alpha = 0f
        titleMain.translationY = dp(24f)
        titleMain.animate().alpha(1f).translationY(0f).setStartDelay(120).setDuration(700).start()
        for (i in 0 until (findViewById<View>(R.id.menuButtons) as LinearLayout).childCount) {
            val child = (findViewById<View>(R.id.menuButtons) as LinearLayout).getChildAt(i)
            child.alpha = 0f
            child.translationX = -dp(28f)
            child.animate().alpha(1f).translationX(0f)
                .setStartDelay((260 + i * 90).toLong()).setDuration(420).start()
        }
    }

    private fun showCharacterSelect() {
        screenMenu.visibility = View.GONE
        screenChars.visibility = View.VISIBLE
        for ((i, card) in cards.withIndex()) {
            card.alpha = 0f
            card.translationY = dp(40f)
            card.animate().alpha(if (i == selectedChar) 1f else 0.7f)
                .translationY(-if (i == selectedChar) dp(16f) else 0f)
                .setStartDelay((i * 70).toLong()).setDuration(380).start()
        }
        selectCharacter(selectedChar, animate = false)
    }

    private fun startGame() {
        Engine.reset()
        Engine.setCharacter(selectedChar)
        hud.applyJoystickSide(prefs.getBoolean("joyRight", false))
        hud.visibility = View.VISIBLE
        menuRoot.visibility = View.GONE
        pauseRoot.visibility = View.GONE
        game.paused = false
    }

    private fun backToMenu() {
        game.paused = true
        hud.visibility = View.GONE
        menuRoot.visibility = View.VISIBLE
        screenChars.visibility = View.GONE
        screenMenu.visibility = View.VISIBLE
        gpuInfo.text = Engine.glInfo()
    }

    private fun showPause(show: Boolean) {
        pauseRoot.visibility = if (show) View.VISIBLE else View.GONE
        game.paused = show
        if (!show && menuRoot.visibility == View.VISIBLE) {
            // settings opened from the title screen: stay paused
            game.paused = true
        }
    }

    override fun onResume() {
        super.onResume()
        game.onResume()
        hideSystemBars()
        if (menuRoot.visibility == View.VISIBLE) game.paused = true
    }

    override fun onPause() {
        super.onPause()
        game.onPause()
    }

    override fun onBackPressed() {
        when {
            pauseRoot.visibility == View.VISIBLE -> showPause(false)
            screenChars.visibility == View.VISIBLE -> {
                screenChars.visibility = View.GONE
                screenMenu.visibility = View.VISIBLE
            }
            menuRoot.visibility == View.GONE -> showPause(true)
            else -> super.onBackPressed()
        }
    }
}
