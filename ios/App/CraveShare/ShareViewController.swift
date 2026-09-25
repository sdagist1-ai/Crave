import UIKit
import UniformTypeIdentifiers

/// Appears as "Crave" in the share sheet. Takes the place someone shares from
/// Apple Maps, Google Maps (or any link or text) and opens Crave with it:
///   craveapp://share?url=<link>&text=<shared text>
/// The app works out which restaurant it is and opens "Add to…" for it.
final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        Task { await handOff() }
    }

    private func handOff() async {
        var link: String?
        var texts: [String] = []

        for item in extensionContext?.inputItems as? [NSExtensionItem] ?? [] {
            if let text = item.attributedContentText?.string, !text.isEmpty { texts.append(text) }
            for provider in item.attachments ?? [] {
                if link == nil, provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                   let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL,
                   !url.isFileURL {
                    link = url.absoluteString
                } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                          let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                    texts.append(text)
                }
            }
        }

        var components = URLComponents()
        components.scheme = "craveapp"
        components.host = "share"
        components.queryItems = [
            URLQueryItem(name: "url", value: link),
            URLQueryItem(name: "text", value: String(texts.joined(separator: "\n").prefix(2000))),
        ].filter { !($0.value ?? "").isEmpty }
        // "+" is legal in a query but the app reads it as a space; Google place links use it.
        components.percentEncodedQuery = components.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")

        if let target = components.url { await openContainingApp(target) }
        extensionContext?.completeRequest(returningItems: nil)
    }

    /// Extensions can't use UIApplication.shared, so find the app in the responder chain.
    @MainActor private func openContainingApp(_ url: URL) {
        var responder: UIResponder? = self
        while let current = responder {
            if let app = current as? UIApplication {
                app.open(url, options: [:], completionHandler: nil)
                return
            }
            responder = current.next
        }
    }
}
