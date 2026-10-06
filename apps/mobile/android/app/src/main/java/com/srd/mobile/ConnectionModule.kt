package com.srd.mobile

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

/** Guarda solo la dirección y la junta; nunca credenciales ni cookies. */
class ConnectionModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val preferences = context.getSharedPreferences("srd_connection", 0)

  override fun getName(): String = "SrdConnection"

  @ReactMethod
  fun load(promise: Promise) {
    val result = WritableNativeMap()
    result.putString("origin", preferences.getString("origin", ""))
    result.putString("code", preferences.getString("code", ""))
    promise.resolve(result)
  }

  @ReactMethod
  fun save(origin: String, code: String, promise: Promise) {
    if (preferences.edit().putString("origin", origin).putString("code", code).commit()) {
      promise.resolve(null)
    } else {
      promise.reject("SAVE_FAILED", "No se pudo guardar la dirección de la junta.")
    }
  }

  @ReactMethod
  fun clear(promise: Promise) {
    if (preferences.edit().clear().commit()) {
      promise.resolve(null)
    } else {
      promise.reject("CLEAR_FAILED", "No se pudo borrar la dirección de la junta.")
    }
  }
}
