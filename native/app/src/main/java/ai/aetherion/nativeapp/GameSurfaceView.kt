package ai.aetherion.nativeapp

import android.content.Context
import android.opengl.GLSurfaceView
import android.util.AttributeSet
import android.view.MotionEvent
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.hypot

/**
 * Hosts the native GL renderer and turns unhandled touches into camera drags.
 * The HUD overlay sits on top and only consumes the touches it actually uses,
 * so dragging anywhere else orbits the camera.
 */
class GameSurfaceView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : GLSurfaceView(context, attrs) {

    var onFrame: ((FloatArray) -> Unit)? = null
    var paused = false

    private var lastTime = 0L
    private var lastX = 0f
    private var lastY = 0f
    private var dragPointer = -1
    private var sensitivity = 1.0f

    init {
        setEGLContextClientVersion(3)
        setEGLConfigChooser(8, 8, 8, 8, 24, 0)
        preserveEGLContextOnPause = true
        setRenderer(object : Renderer {
            override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
                Engine.create()
                lastTime = System.nanoTime()
            }

            override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
                Engine.resize(width, height)
            }

            override fun onDrawFrame(gl: GL10?) {
                val now = System.nanoTime()
                var dt = (now - lastTime) / 1_000_000_000f
                lastTime = now
                if (dt <= 0f || dt > 0.2f) dt = 1f / 60f
                if (paused) dt = 0f
                Engine.frame(dt)
                onFrame?.invoke(Engine.state())
            }
        })
        renderMode = RENDERMODE_CONTINUOUSLY
    }

    fun setLookSensitivity(value: Float) {
        sensitivity = value
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                dragPointer = event.getPointerId(0)
                lastX = event.x
                lastY = event.y
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                if (dragPointer < 0) {
                    val idx = event.actionIndex
                    dragPointer = event.getPointerId(idx)
                    lastX = event.getX(idx)
                    lastY = event.getY(idx)
                }
            }
            MotionEvent.ACTION_MOVE -> {
                val idx = event.findPointerIndex(dragPointer)
                if (idx >= 0) {
                    val x = event.getX(idx)
                    val y = event.getY(idx)
                    val dx = (x - lastX) * sensitivity
                    val dy = (y - lastY) * sensitivity
                    if (hypot(dx, dy) > 0.01f) Engine.look(dx, dy)
                    lastX = x
                    lastY = y
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> dragPointer = -1
            MotionEvent.ACTION_POINTER_UP -> {
                if (event.getPointerId(event.actionIndex) == dragPointer) dragPointer = -1
            }
        }
        return true
    }
}
