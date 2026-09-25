import UIKit
import Capacitor
import CapacitorUpdaterPlugin

/// The app's Capacitor bridge, with Crave's own native plugins registered.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SharedStorePlugin())

        // Live updates (docs/LIVE_UPDATES.md). Registered by hand: Capacitor's automatic
        // lookup by class name didn't find it in builds 1.4 (7) and (8) ("plugin is not
        // implemented on ios"). Referencing the class here also makes sure it's linked.
        if bridge?.plugin(withName: "CapacitorUpdater") == nil {
            bridge?.registerPluginInstance(CapacitorUpdaterPlugin())
        }
    }
}
