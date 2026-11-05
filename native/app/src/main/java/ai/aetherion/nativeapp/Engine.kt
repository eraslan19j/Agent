package ai.aetherion.nativeapp

/**
 * Bridge to the C++ engine.
 *
 * Every native entry point is prefixed with `n` and wrapped here, so a missing or
 * broken native library degrades into a readable on-screen diagnostic instead of
 * killing the app with an UnsatisfiedLinkError.
 */
object Engine {

    var loadError: String? = null
        private set

    val loaded: Boolean
        get() = loadError == null

    init {
        try {
            System.loadLibrary("aetherion")
        } catch (t: Throwable) {
            loadError = t.toString()
        }
    }

    // ---- raw entry points (jni.cpp) ----
    private external fun nCreate()
    private external fun nResize(w: Int, h: Int)
    private external fun nFrame(dt: Float)
    private external fun nSetMove(x: Float, y: Float)
    private external fun nLook(dx: Float, dy: Float)
    private external fun nSetSprint(on: Boolean)
    private external fun nAction(code: Int)
    private external fun nSetCharacter(id: Int)
    private external fun nSetBrightness(b: Float)
    private external fun nSetQuality(level: Int)
    private external fun nReset()
    private external fun nState(): FloatArray
    private external fun nGlInfo(): String
    private external fun nLastError(): String
    private external fun nReady(): Boolean
    private external fun nDestroy()

    // ---- safe wrappers ----
    private fun <T> guard(fallback: T, block: () -> T): T {
        if (!loaded) return fallback
        return try {
            block()
        } catch (t: Throwable) {
            fallback
        }
    }

    fun create() = guard(Unit) { nCreate() }
    fun resize(w: Int, h: Int) = guard(Unit) { nResize(w, h) }
    fun frame(dt: Float) = guard(Unit) { nFrame(dt) }
    fun setMove(x: Float, y: Float) = guard(Unit) { nSetMove(x, y) }
    fun look(dx: Float, dy: Float) = guard(Unit) { nLook(dx, dy) }
    fun setSprint(on: Boolean) = guard(Unit) { nSetSprint(on) }
    fun action(code: Int) = guard(Unit) { nAction(code) }
    fun setCharacter(id: Int) = guard(Unit) { nSetCharacter(id) }
    fun setBrightness(b: Float) = guard(Unit) { nSetBrightness(b) }
    fun setQuality(level: Int) = guard(Unit) { nSetQuality(level) }
    fun reset() = guard(Unit) { nReset() }
    fun state(): FloatArray = guard(FloatArray(10)) { nState() }
    fun glInfo(): String = guard("motor yüklenemedi") { nGlInfo() }
    fun lastError(): String = guard(loadError ?: "") { nLastError() }
    fun ready(): Boolean = guard(false) { nReady() }
    fun destroy() = guard(Unit) { nDestroy() }

    // action codes (must match jni.cpp)
    const val ACT_ATTACK = 0
    const val ACT_SKILL = 1
    const val ACT_DASH = 2
    const val ACT_JUMP = 3
}
