import UIKit
import Capacitor

/// The app's Capacitor bridge, with Crave's own native plugins registered.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SharedStorePlugin())
    }
}
