import Capacitor
import CapacitorUpdaterPlugin

public let isCapacitorApp = true

/// Plugins Capacitor's automatic lookup by class name doesn't find, registered by hand
/// (called from MainViewController). The live-update plugin was linked but never
/// registered in builds 1.4 (7) and (8): "plugin is not implemented on ios".
/// This lives here because the app target can only import this package, not the
/// plugins inside it; naming the class here also makes sure it's linked.
public func registerMissingPlugins(on bridge: CAPBridgeProtocol?) {
    guard let bridge else { return }
    if bridge.plugin(withName: "CapacitorUpdater") == nil {
        bridge.registerPluginInstance(CapacitorUpdaterPlugin())
    }
}
