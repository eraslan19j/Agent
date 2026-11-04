cmake_minimum_required(VERSION 3.18.1)
project(aetherion CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(aetherion SHARED
    game.cpp
    render.cpp
    jni.cpp
)

target_compile_options(aetherion PRIVATE -O2 -ffast-math -fno-exceptions -fno-rtti -Wall)
target_link_libraries(aetherion PRIVATE GLESv3 log android)
