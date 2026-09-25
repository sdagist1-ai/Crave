import Foundation
import Capacitor

/// Key–value storage in the App Group that Crave shares with its share extension
/// (CraveShare). The Supabase session is kept here, so the share sheet can save a
/// place from Apple Maps or Google Maps while signed in, and whichever of the two
/// refreshes the session, the other reads the new tokens.
@objc(SharedStorePlugin)
public class SharedStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SharedStorePlugin"
    public let jsName = "SharedStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
    ]

    /// Must match the App Groups entitlement of both targets and CraveShare/SharedStore.swift.
    static let suiteName = "group.com.carldagist.crave"

    private let defaults = UserDefaults(suiteName: SharedStorePlugin.suiteName)

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { return call.reject("Must provide a key") }
        guard let defaults else { return call.reject("App Group storage unavailable") }
        call.resolve(["value": defaults.string(forKey: key) as Any])
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { return call.reject("Must provide a key") }
        guard let defaults else { return call.reject("App Group storage unavailable") }
        defaults.set(call.getString("value", ""), forKey: key)
        call.resolve()
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { return call.reject("Must provide a key") }
        guard let defaults else { return call.reject("App Group storage unavailable") }
        defaults.removeObject(forKey: key)
        call.resolve()
    }
}
