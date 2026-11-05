package ai.aetherion.nativeapp

/**
 * Bridge to the C++ block engine. Every native call is wrapped so a broken or
 * missing library can never crash the app — it just reports "not ready".
 */
object Engine {

    var loadError: String? = null
        private set

    val loaded: Boolean get() = loadError == null

    init {
        try {
            System.loadLibrary("aetherion")
        } catch (t: Throwable) {
            loadError = t.toString()
        }
    }

    private external fun nCreate()
    private external fun nResize(w: Int, h: Int)
    private external fun nFrame(dt: Float)
    private external fun nSetMove(x: Float, y: Float)
    private external fun nLook(dx: Float, dy: Float)
    private external fun nJump()
    private external fun nSetSprint(on: Boolean)
    private external fun nSetSensitivity(s: Float)
    private external fun nReset()
    private external fun nState(): FloatArray
    private external fun nGlInfo(): String
    private external fun nLastError(): String
    private external fun nReady(): Boolean
    private external fun nDestroy()

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
    fun jump() = guard(Unit) { nJump() }
    fun setSprint(on: Boolean) = guard(Unit) { nSetSprint(on) }
    fun setSensitivity(s: Float) = guard(Unit) { nSetSensitivity(s) }
    fun reset() = guard(Unit) { nReset() }
    fun state(): FloatArray = guard(FloatArray(10)) { nState() }
    fun glInfo(): String = guard("motor yüklenemedi") { nGlInfo() }
    fun lastError(): String = guard(loadError ?: "") { nLastError() }
    fun ready(): Boolean = guard(false) { nReady() }
    fun destroy() = guard(Unit) { nDestroy() }

    // state indices
    const val S_COINS = 0
    const val S_TOTAL = 1
    const val S_TIME = 2
    const val S_X = 3
    const val S_Y = 4
    const val S_Z = 5
    const val S_WON = 6
    const val S_RESPAWNS = 7
    const val S_GROUNDED = 9
}
