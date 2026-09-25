import UIKit
import SwiftUI
import UniformTypeIdentifiers

/// Appears as "Crave" in the share sheet. When someone shares a place from Apple
/// Maps or Google Maps, it shows a small "Add to Crave" sheet over Maps: it finds
/// the restaurant, lets them pick a list and a vibe, and saves it without leaving
/// Maps. "Open in Crave" hands the share to the app instead:
///   craveapp://share?url=<link>&text=<shared text>
final class ShareViewController: UIViewController {
    private var payload: (url: String?, text: String?)?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.973, green: 0.980, blue: 0.988, alpha: 1)

        let model = ShareModel(
            payload: { [weak self] in await self?.sharedPayload() ?? (nil, nil) },
            finish: { [weak self] in self?.close() },
            openInApp: { [weak self] in self?.handOffToApp() }
        )
        let host = UIHostingController(rootView: ShareView(model: model))
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.backgroundColor = .clear
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        host.didMove(toParent: self)
    }

    /// The link and text that were shared (read once, then reused).
    private func sharedPayload() async -> (url: String?, text: String?) {
        if let payload { return payload }
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

        let text = String(texts.joined(separator: "\n").prefix(2000))
        let result = (url: link, text: text.isEmpty ? nil : text)
        payload = result
        return result
    }

    private func close() {
        extensionContext?.completeRequest(returningItems: nil)
    }

    /// Opens Crave's own "Add a place" with what was shared.
    private func handOffToApp() {
        Task {
            let shared = await sharedPayload()
            var components = URLComponents()
            components.scheme = "craveapp"
            components.host = "share"
            components.queryItems = [
                URLQueryItem(name: "url", value: shared.url),
                URLQueryItem(name: "text", value: shared.text),
            ].filter { !($0.value ?? "").isEmpty }
            // "+" is legal in a query but the app reads it as a space; Google place links use it.
            components.percentEncodedQuery = components.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B")
            if let target = components.url { openContainingApp(target) }
            close()
        }
    }

    /// Extensions can't use UIApplication.shared, so find the app in the responder chain.
    private func openContainingApp(_ url: URL) {
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
