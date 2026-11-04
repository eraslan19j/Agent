package ai.aetherion.nativeapp

/**
 * Thin bridge to the C++ engine. Keep this surface stable: every method here
 * maps 1:1 to a JNI entry point in jni.cpp.
 */
object Engine {
    init {
        System.loadLibrary("aetherion")
    }

    external fun create()
    external fun resize(w: Int, h: Int)
    external fun frame(dt: Float)
    external fun setMove(x: Float, y: Float)
    external fun look(dx: Float, dy: Float)
    external fun setSprint(on: Boolean)
    external fun action(code: Int)
    external fun setCharacter(id: Int)
    external fun setBrightness(b: Float)
    external fun setQuality(level: Int)
    external fun reset()
    external fun state(): FloatArray
    external fun glInfo(): String
    external fun destroy()

    // action codes (must match jni.cpp)
    const val ACT_ATTACK = 0
    const val ACT_SKILL = 1
    const val ACT_DASH = 2
    const val ACT_JUMP = 3
}
