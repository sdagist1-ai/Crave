import UIKit
import Capacitor
import CapApp_SPM

/// The app's Capacitor bridge, with Crave's own native plugins registered.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SharedStorePlugin())
        // Live updates (docs/LIVE_UPDATES.md); see CapApp-SPM.swift for why.
        registerMissingPlugins(on: bridge)
    }
}
