package ai.aetherion.nativeapp

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Roblox-style touch controls: a stick on the left, a big JUMP button on the right.
 * Everything is drawn on a canvas so there are no layout/asset failure modes.
 */
class HudView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    var onMove: ((Float, Float) -> Unit)? = null
    var onJump: (() -> Unit)? = null

    private val density = resources.displayMetrics.density
    private fun dp(v: Float) = v * density

    private val baseRadius = dp(74f)
    private val knobRadius = dp(34f)
    private val jumpRadius = dp(52f)

    private var baseX = 0f
    private var baseY = 0f
    private var jumpX = 0f
    private var jumpY = 0f

    private var knobX = 0f
    private var knobY = 0f
    private var joyPointer = -1
    private var jumpPointer = -1

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        typeface = android.graphics.Typeface.DEFAULT_BOLD
    }
    private val rect = RectF()

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        val margin = dp(28f)
        baseX = baseRadius + margin
        baseY = h - baseRadius - margin
        jumpX = w - jumpRadius - margin
        jumpY = h - jumpRadius - margin - dp(10f)
        knobX = baseX
        knobY = baseY
        textPaint.textSize = dp(15f)
    }

    fun releaseStick() {
        joyPointer = -1
        jumpPointer = -1
        knobX = baseX
        knobY = baseY
        onMove?.invoke(0f, 0f)
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        // stick base
        paint.style = Paint.Style.FILL
        paint.color = Color.argb(70, 255, 255, 255)
        canvas.drawCircle(baseX, baseY, baseRadius, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = dp(3f)
        paint.color = Color.argb(140, 255, 255, 255)
        canvas.drawCircle(baseX, baseY, baseRadius, paint)

        // knob
        paint.strokeWidth = dp(2f)
        paint.style = Paint.Style.FILL
        paint.color = Color.argb(190, 255, 255, 255)
        canvas.drawCircle(knobX, knobY, knobRadius, paint)

        // jump button
        val pressed = jumpPointer >= 0
        paint.style = Paint.Style.FILL
        paint.color = if (pressed) Color.argb(235, 255, 205, 60) else Color.argb(200, 60, 140, 240)
        canvas.drawCircle(jumpX, jumpY, jumpRadius, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = dp(3f)
        paint.color = Color.argb(200, 255, 255, 255)
        canvas.drawCircle(jumpX, jumpY, jumpRadius, paint)

        textPaint.textSize = dp(16f)
        canvas.drawText("ZIPLA", jumpX, jumpY + dp(6f), textPaint)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                val idx = event.actionIndex
                val x = event.getX(idx)
                val y = event.getY(idx)
                val id = event.getPointerId(idx)
                val dj = dist(x, y, jumpX, jumpY)
                if (dj < jumpRadius * 1.35f) {
                    jumpPointer = id
                    onJump?.invoke()
                    invalidate()
                } else if (joyPointer < 0) {
                    joyPointer = id
                    updateStick(x, y)
                }
            }
            MotionEvent.ACTION_MOVE -> {
                val ji = event.findPointerIndex(joyPointer)
                if (ji >= 0) {
                    updateStick(event.getX(ji), event.getY(ji))
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> releaseStick()
            MotionEvent.ACTION_POINTER_UP -> {
                val id = event.getPointerId(event.actionIndex)
                if (id == joyPointer) {
                    joyPointer = -1
                    knobX = baseX
                    knobY = baseY
                    onMove?.invoke(0f, 0f)
                    invalidate()
                }
                if (id == jumpPointer) {
                    jumpPointer = -1
                    invalidate()
                }
            }
        }
        return true
    }

    private fun dist(x: Float, y: Float, cx: Float, cy: Float): Float {
        val dx = x - cx
        val dy = y - cy
        return sqrt(dx * dx + dy * dy)
    }

    private fun updateStick(x: Float, y: Float) {
        var dx = x - baseX
        var dy = y - baseY
        val d = sqrt(dx * dx + dy * dy)
        val maxR = baseRadius
        if (d > maxR) {
            dx = dx * (maxR / d)
            dy = dy * (maxR / d)
        }
        knobX = baseX + dx
        knobY = baseY + dy
        val nx = if (maxR > 0f) (dx / maxR).coerceIn(-1f, 1f) else 0f
        val ny = if (maxR > 0f) (-dy / maxR).coerceIn(-1f, 1f) else 0f
        // stick right -> +x (right), stick up -> +y (forward)
        onMove?.invoke(nx, ny)
        invalidate()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        visibility = VISIBLE
    }

    /** keeps the button positions correct after a rotation/resize */
    fun refreshLayout() {
        onSizeChanged(width, height, 0, 0)
        rect.setEmpty()
        invalidate()
    }

    companion object {
        @Suppress("unused")
        fun clampUnit(v: Float) = min(1f, kotlin.math.abs(v)) * if (v < 0) -1f else 1f
    }
}
