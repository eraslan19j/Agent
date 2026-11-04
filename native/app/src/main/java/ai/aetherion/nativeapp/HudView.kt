package ai.aetherion.nativeapp

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.sin

/**
 * In-game touch HUD drawn with Canvas: joystick, action buttons, vital bars.
 * The joystick can sit on the left (default, like Genshin) or on the right,
 * and screen-up always means "forward".
 */
class HudView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    var joystickRight = false
    var onMove: ((Float, Float) -> Unit)? = null
    var onAction: ((Int) -> Unit)? = null
    var onSprint: ((Boolean) -> Unit)? = null
    var onCharacter: ((Int) -> Unit)? = null
    var onPause: (() -> Unit)? = null

    private val density = resources.displayMetrics.density
    private fun dp(v: Float) = v * density

    private var hp = 1f
    private var hpMax = 1f
    private var stamina = 100f
    private var energy = 0f
    private var skillCd = 0f
    private var dashCd = 0f
    private var character = 0
    private var enemiesAlive = 0

    private var joyActive = false
    private var joyPointer = -1
    private var joyCx = 0f
    private var joyCy = 0f
    private var knobX = 0f
    private var knobY = 0f
    private var joyRadius = 0f

    private var actionPointer = -1
    private var pressedIndex = -1
    private var sprintPointer = -1

    private class Btn(
        val code: Int,
        val label: String,
        val sub: String,
        var cx: Float = 0f,
        var cy: Float = 0f,
        var r: Float = 0f,
        val main: Boolean = false,
        val color: Int = Color.WHITE,
    )

    private val buttons = listOf(
        Btn(Engine.ACT_ATTACK, "⚔", "SALDIR", main = true, color = 0xFFFFD9A0.toInt()),
        Btn(Engine.ACT_SKILL, "◈", "YETENEK", color = 0xFFB98CFF.toInt()),
        Btn(Engine.ACT_DASH, "⇢", "KAÇIN", color = 0xFF9FD8FF.toInt()),
        Btn(Engine.ACT_JUMP, "⇧", "ZIPLA", color = 0xFFCFE8FF.toInt()),
    )

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
    }
    private val barRect = RectF()
    private val arcRect = RectF()
    private val path = Path()
    private val elementColors = intArrayOf(
        0xFF6FE8C4.toInt(), // anemo
        0xFFFF8A3D.toInt(), // pyro
        0xFFB06FFF.toInt(), // electro
        0xFF8CD8FF.toInt(), // cryo
    )
    private val characterNames = arrayOf("KAEL", "SERA", "RIN", "BORA")

    fun update(state: FloatArray) {
        if (state.size >= 10) {
            hp = state[0]
            hpMax = state[1].coerceAtLeast(1f)
            stamina = state[2]
            energy = state[3]
            character = state[4].toInt()
            enemiesAlive = state[7].toInt()
            skillCd = state[8]
            dashCd = state[9]
        }
        invalidate()
    }

    /** Switching sides must re-layout immediately (not only on the next resize). */
    fun applyJoystickSide(right: Boolean) {
        joystickRight = right
        if (width > 0 && height > 0) layoutControls(width, height)
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        layoutControls(w, h)
    }

    private fun layoutControls(w: Int, h: Int) {
        val margin = dp(26f)
        joyRadius = min(dp(62f), w * 0.11f)
        joyCx = if (joystickRight) w - margin - joyRadius else margin + joyRadius
        joyCy = h - margin - joyRadius
        knobX = joyCx
        knobY = joyCy

        val big = min(dp(46f), w * 0.075f)
        buttons[0].apply { cx = w - margin - big; cy = h - margin - big; r = big }
        buttons[1].apply { cx = w - margin - big * 2.4f; cy = h - margin - big * 2.1f; r = big * 0.82f }
        buttons[2].apply { cx = w - margin - big * 0.55f; cy = h - margin - big * 2.5f; r = big * 0.74f }
        buttons[3].apply { cx = w - margin - big * 2.6f; cy = h - margin - big * 0.62f; r = big * 0.70f }
    }

    // ------------------------------------------------------------------ draw
    override fun onDraw(canvas: Canvas) {
        drawBars(canvas)
        drawJoystick(canvas)
        drawButtons(canvas)
        drawParty(canvas)
        drawPause(canvas)
    }

    private fun drawBars(canvas: Canvas) {
        val x = dp(22f)
        val y = dp(52f)
        val w = min(width * 0.34f, dp(300f))
        val h = dp(9f)

        // hp
        barRect.set(x, y, x + w, y + h)
        paint.shader = null
        paint.color = 0x66101820
        canvas.drawRoundRect(barRect, h / 2, h / 2, paint)
        val hpFrac = (hp / hpMax).coerceIn(0f, 1f)
        barRect.set(x, y, x + w * hpFrac, y + h)
        paint.shader = LinearGradient(x, y, x + w * hpFrac, y, 0xFFE8C983.toInt(), 0xFF8FE3A8.toInt(), Shader.TileMode.CLAMP)
        canvas.drawRoundRect(barRect, h / 2, h / 2, paint)
        paint.shader = null

        // stamina
        barRect.set(x, y + h + dp(5f), x + w * 0.78f, y + h * 2f + dp(5f))
        paint.color = 0x55101820
        canvas.drawRoundRect(barRect, h / 2, h / 2, paint)
        barRect.set(x, y + h + dp(5f), x + w * 0.78f * (stamina / 100f).coerceIn(0f, 1f), y + h * 2f + dp(5f))
        paint.color = 0xFF9BE8C8.toInt()
        canvas.drawRoundRect(barRect, h / 2, h / 2, paint)

        // energy
        barRect.set(x, y + h * 2f + dp(10f), x + w * 0.5f, y + h * 2.7f + dp(10f))
        paint.color = 0x55101820
        canvas.drawRoundRect(barRect, h / 2, h / 2, paint)
        barRect.set(x, y + h * 2f + dp(10f), x + w * 0.5f * (energy / 100f).coerceIn(0f, 1f), y + h * 2.7f + dp(10f))
        paint.color = elementColors[character % 4]
        canvas.drawRoundRect(barRect, h / 2, h / 2, paint)

        textPaint.textSize = dp(11f)
        textPaint.textAlign = Paint.Align.LEFT
        textPaint.color = 0xCCFFFFFF.toInt()
        canvas.drawText("${hp.toInt()} / ${hpMax.toInt()}", x + dp(2f), y - dp(6f), textPaint)
        textPaint.color = 0x99FFFFFF.toInt()
        textPaint.textSize = dp(10f)
        canvas.drawText("${characterNames[character % 4]}  ·  düşman $enemiesAlive", x + dp(2f), y + h * 3.4f + dp(10f), textPaint)
    }

    private fun drawJoystick(canvas: Canvas) {
        // outer glow
        paint.shader = RadialGradient(
            joyCx, joyCy, joyRadius * 1.35f,
            intArrayOf(0x33FFFFFF, 0x11FFFFFF, 0x00000000),
            floatArrayOf(0f, 0.55f, 1f),
            Shader.TileMode.CLAMP,
        )
        canvas.drawCircle(joyCx, joyCy, joyRadius * 1.35f, paint)
        paint.shader = null

        paint.color = 0x2AFFFFFF
        canvas.drawCircle(joyCx, joyCy, joyRadius, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = dp(1.6f)
        paint.color = 0x66FFFFFF
        canvas.drawCircle(joyCx, joyCy, joyRadius, paint)
        paint.style = Paint.Style.FILL

        // direction ticks
        for (i in 0 until 4) {
            val a = i * Math.PI.toFloat() / 2f
            paint.color = 0x33FFFFFF
            canvas.drawCircle(
                joyCx + cos(a) * joyRadius * 0.78f,
                joyCy + sin(a) * joyRadius * 0.78f,
                dp(2.2f), paint,
            )
        }

        val kx = if (joyActive) knobX else joyCx
        val ky = if (joyActive) knobY else joyCy
        paint.shader = RadialGradient(
            kx - dp(6f), ky - dp(8f), joyRadius * 0.85f,
            intArrayOf(0xFFFFFFFF.toInt(), 0xFFCFE4FF.toInt(), 0xFF6E8FBF.toInt()),
            floatArrayOf(0f, 0.5f, 1f), Shader.TileMode.CLAMP,
        )
        canvas.drawCircle(kx, ky, joyRadius * 0.42f, paint)
        paint.shader = null
        ringPaint.strokeWidth = dp(1.5f)
        ringPaint.color = 0x88FFFFFF.toInt()
        canvas.drawCircle(kx, ky, joyRadius * 0.42f, ringPaint)
    }

    private fun drawButtons(canvas: Canvas) {
        for ((index, b) in buttons.withIndex()) {
            val pressed = pressedIndex == index
            val radius = b.r * if (pressed) 0.94f else 1f
            val glowColor = if (b.main) 0x88FFC978.toInt() else 0x55FFFFFF

            paint.shader = RadialGradient(
                b.cx, b.cy, radius * 1.6f,
                intArrayOf(glowColor, 0x22000000, 0x00000000),
                floatArrayOf(0f, 0.6f, 1f), Shader.TileMode.CLAMP,
            )
            canvas.drawCircle(b.cx, b.cy, radius * 1.6f, paint)
            paint.shader = null

            paint.color = if (b.main) 0xE6B9793C.toInt() else 0xCC16202E.toInt()
            canvas.drawCircle(b.cx, b.cy, radius, paint)

            ringPaint.strokeWidth = dp(2f)
            ringPaint.color = if (b.main) 0xFFFFE0B0.toInt() else 0x66FFFFFF
            canvas.drawCircle(b.cx, b.cy, radius, ringPaint)

            textPaint.color = b.color
            textPaint.textSize = radius * (if (b.main) 0.95f else 0.8f)
            canvas.drawText(b.label, b.cx, b.cy + radius * 0.32f, textPaint)
            textPaint.textSize = dp(8f)
            textPaint.color = 0x99FFFFFF.toInt()
            canvas.drawText(b.sub, b.cx, b.cy + radius * 1.35f, textPaint)

            // cooldown arcs
            val cd = when (b.code) {
                Engine.ACT_SKILL -> skillCd / 7.5f
                Engine.ACT_DASH -> dashCd / 1.0f
                else -> 0f
            }
            if (cd > 0.01f) {
                paint.color = 0x99000000.toInt()
                canvas.drawCircle(b.cx, b.cy, radius, paint)
                arcRect.set(b.cx - radius * 0.78f, b.cy - radius * 0.78f, b.cx + radius * 0.78f, b.cy + radius * 0.78f)
                ringPaint.strokeWidth = dp(3f)
                ringPaint.color = 0xCCFFFFFF.toInt()
                canvas.drawArc(arcRect, -90f, 360f * (1f - cd), false, ringPaint)
            }
        }
        // sprint hint
        textPaint.textSize = dp(9f)
        textPaint.color = 0x77FFFFFF
        val sprintX = if (joystickRight) dp(36f) else width - dp(36f)
        canvas.drawText("»", sprintX, height - dp(30f), textPaint)
    }

    private fun drawParty(canvas: Canvas) {
        val r = dp(15f)
        val gap = dp(11f)
        var x = width - dp(76f)
        val y = dp(44f)
        for (i in 3 downTo 0) {
            val active = i == character
            paint.color = if (active) elementColors[i] else 0x77101820
            canvas.drawCircle(x, y, if (active) r * 1.12f else r * 0.85f, paint)
            ringPaint.strokeWidth = dp(1.5f)
            ringPaint.color = if (active) 0xFFFFFFFF.toInt() else 0x44FFFFFF
            canvas.drawCircle(x, y, if (active) r * 1.12f else r * 0.85f, ringPaint)
            textPaint.textSize = dp(9f)
            textPaint.color = if (active) 0xFF101820.toInt() else 0xAAFFFFFF.toInt()
            canvas.drawText(characterNames[i].take(1), x, y + dp(3.2f), textPaint)
            x -= r * 2f + gap
        }
    }

    private fun drawCharacterAt(canvas: Canvas, index: Int) {
        val r = dp(15f)
        val x = width - dp(76f) - index * (r * 2f + dp(11f))
        val y = dp(44f)
        if (hypot(x, y) >= 0f) canvas.drawCircle(x, y, r, paint)
    }

    private fun drawPause(canvas: Canvas) {
        val r = dp(17f)
        val cx = width - dp(24f) - r
        val cy = dp(20f) + r
        paint.color = 0x88101820.toInt()
        canvas.drawCircle(cx, cy, r, paint)
        ringPaint.strokeWidth = dp(1.4f)
        ringPaint.color = 0x66FFFFFF
        canvas.drawCircle(cx, cy, r, ringPaint)
        paint.color = 0xFFFFFFFF.toInt()
        val bw = dp(2.4f)
        val bh = dp(8f)
        canvas.drawRect(cx - dp(4f) - bw, cy - bh, cx - dp(4f), cy + bh, paint)
        canvas.drawRect(cx + dp(4f), cy - bh, cx + dp(4f) + bw, cy + bh, paint)
    }

    // ------------------------------------------------------------------ input
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                val idx = event.actionIndex
                return press(event.getX(idx), event.getY(idx), event.getPointerId(idx))
            }
            MotionEvent.ACTION_MOVE -> {
                for (i in 0 until event.pointerCount) {
                    val id = event.getPointerId(i)
                    if (id == joyPointer) updateJoystick(event.getX(i), event.getY(i))
                }
                return joyPointer >= 0 || actionPointer >= 0
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                releaseAll()
                return true
            }
            MotionEvent.ACTION_POINTER_UP -> {
                val id = event.getPointerId(event.actionIndex)
                if (id == joyPointer) releaseJoystick()
                if (id == actionPointer) {
                    actionPointer = -1
                    pressedIndex = -1
                    invalidate()
                }
                return true
            }
        }
        return false
    }

    private fun press(x: Float, y: Float, pointerId: Int): Boolean {
        // pause button
        val pr = dp(17f)
        val pcx = width - dp(24f) - pr
        val pcy = dp(20f) + pr
        if (hypot(x - pcx, y - pcy) < pr * 1.3f) {
            onPause?.invoke()
            return true
        }
        // party buttons
        val r = dp(15f)
        var px = width - dp(76f)
        val py = dp(44f)
        for (i in 3 downTo 0) {
            if (hypot(x - px, y - py) < r * 1.4f) {
                onCharacter?.invoke(i)
                return true
            }
            px -= r * 2f + dp(11f)
        }
        // action buttons
        for ((index, b) in buttons.withIndex()) {
            if (hypot(x - b.cx, y - b.cy) < b.r * 1.15f) {
                actionPointer = pointerId
                pressedIndex = index
                onAction?.invoke(b.code)
                invalidate()
                return true
            }
        }
        // joystick
        if (hypot(x - joyCx, y - joyCy) < joyRadius * 1.9f) {
            joyActive = true
            joyPointer = pointerId
            updateJoystick(x, y)
            return true
        }
        return false
    }

    private fun updateJoystick(x: Float, y: Float) {
        var dx = x - joyCx
        var dy = y - joyCy
        val len = hypot(dx, dy)
        val maxLen = joyRadius * 0.92f
        if (len > maxLen && len > 0.001f) {
            dx = dx / len * maxLen
            dy = dy / len * maxLen
        }
        knobX = joyCx + dx
        knobY = joyCy + dy
        // screen-up must always mean "forward" — this is the fix for the inverted stick
        val nx = dx / maxLen
        val ny = -dy / maxLen
        onMove?.invoke(nx.coerceIn(-1f, 1f), ny.coerceIn(-1f, 1f))
        onSprint?.invoke(ny > 0.72f)
        invalidate()
    }

    private fun releaseJoystick() {
        joyActive = false
        joyPointer = -1
        knobX = joyCx
        knobY = joyCy
        onMove?.invoke(0f, 0f)
        onSprint?.invoke(false)
        invalidate()
    }

    private fun releaseAll() {
        releaseJoystick()
        actionPointer = -1
        pressedIndex = -1
        invalidate()
    }
}
