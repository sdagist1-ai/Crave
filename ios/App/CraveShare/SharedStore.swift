import Foundation

/// The App Group storage shared with the Crave app (see App/SharedStorePlugin.swift).
/// The app writes its Supabase config and session here; the share sheet reads
/// them, and writes the session back when it has to refresh it.
enum SharedStore {
    static let suiteName = "group.com.carldagist.crave"
    static let defaults = UserDefaults(suiteName: suiteName)

    /// Written by the app on launch: { url, anonKey, storageKey }.
    static let configKey = "crave.config"
    /// The list the app has open, so the share sheet can default to it.
    static let activeGroupKey = "crave.activeGroupId"
    /// The list last used from the share sheet (takes precedence over the app's).
    static let lastShareGroupKey = "crave.shareGroupId"

    static func string(_ key: String) -> String? { defaults?.string(forKey: key) }
    static func set(_ value: String, _ key: String) { defaults?.set(value, forKey: key) }
}
