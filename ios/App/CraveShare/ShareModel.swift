import Foundation
import UIKit

/// Drives the share sheet: works out which restaurant was shared, lets the user
/// pick a list and vibe, and saves it — all without leaving Maps.
@MainActor
final class ShareModel: ObservableObject {
    enum Phase: Equatable {
        case loading(String)
        case needsSignIn
        case choose([PlaceResult])
        case ready
        case saving
        case saved(listName: String)
        case failed(String)
    }

    static let vibeOptions = ["Casual", "Elegant"]

    @Published private(set) var phase: Phase = .loading("Finding the spot you shared…")
    @Published private(set) var place: PlaceResult?
    @Published private(set) var details: PlaceDetails?
    @Published private(set) var lists: [CraveList] = []
    @Published var listId: String?
    @Published var vibes: Set<String> = []
    @Published var note = ""
    @Published private(set) var saveError: String?

    /// What was shared (a link and/or text), gathered by the view controller.
    private let payload: () async -> (url: String?, text: String?)
    /// Closes the share sheet.
    let finish: () -> Void
    /// Hands the share to the app instead (the "Open in Crave" fallback).
    let openInApp: () -> Void

    private var api: CraveAPI?
    private var detailsTask: Task<PlaceDetails?, Never>?

    init(payload: @escaping () async -> (url: String?, text: String?),
         finish: @escaping () -> Void,
         openInApp: @escaping () -> Void) {
        self.payload = payload
        self.finish = finish
        self.openInApp = openInApp
    }

    var listName: String { lists.first { $0.id == listId }?.name ?? "your list" }
    var canSave: Bool { place != nil && listId != nil && !vibes.isEmpty && phase == .ready }

    private var started = false

    func start() async {
        guard !started else { return }
        started = true
        guard let api = CraveAPI() else { phase = .needsSignIn; return }
        self.api = api
        do {
            // Validate (and if needed refresh) the session once, before anything runs in parallel.
            _ = try await api.accessToken()

            let shared = await payload()
            async let listsCall = api.myLists()
            let target = try await api.resolveShare(url: shared.url, text: shared.text)
            let results = try await api.search(target.query, near: target)
            lists = try await listsCall
            pickDefaultList()

            guard !lists.isEmpty else {
                phase = .failed("You're not in a Cravelist yet. Open Crave to start one.")
                return
            }
            if let match = results.first(where: { Self.sameName($0.name, target.name) }) {
                select(match)
            } else if results.isEmpty {
                phase = .failed("Couldn't find “\(target.name)”. Open Crave to search for it.")
            } else {
                phase = .choose(Array(results.prefix(6)))
            }
        } catch CraveError.notSignedIn {
            phase = .needsSignIn
        } catch let error as CraveError {
            phase = .failed(error.localizedDescription)
        } catch {
            phase = .failed("Couldn't read that place. Open Crave to search for it.")
        }
    }

    func select(_ result: PlaceResult) {
        place = result
        details = nil
        phase = .ready
        // Rating, price and hours come with the details (search results don't carry them).
        // Created on the main actor, so the task runs there too.
        detailsTask = Task { [api] in
            let fetched = try? await api?.details(placeId: result.id)
            if self.place?.id == result.id { self.details = fetched }
            return fetched
        }
    }

    func toggle(_ vibe: String) {
        if vibes.contains(vibe) { vibes.remove(vibe) } else { vibes.insert(vibe) }
    }

    func save() async {
        guard let api, let place, let listId, canSave else { return }
        phase = .saving
        saveError = nil
        let fetchedDetails = await detailsTask?.value ?? details
        var photoUrl: String?
        if let photoName = place.photoUrl {
            photoUrl = await api.cachePhoto(photoName: photoName, placeId: place.id)
        }
        do {
            try await api.save(place: place, details: fetchedDetails, photoUrl: photoUrl, listId: listId,
                               vibes: Self.vibeOptions.filter { vibes.contains($0) },
                               notes: note.trimmingCharacters(in: .whitespacesAndNewlines))
            SharedStore.set(listId, SharedStore.lastShareGroupKey)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            phase = .saved(listName: listName)
            try? await Task.sleep(nanoseconds: 1_300_000_000)
            finish()
        } catch CraveError.notSignedIn {
            phase = .needsSignIn
        } catch {
            saveError = (error as? CraveError)?.localizedDescription ?? "Couldn't save. Try again."
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            phase = .ready
        }
    }

    // MARK: Helpers

    private func pickDefaultList() {
        let preferred = [SharedStore.string(SharedStore.lastShareGroupKey), SharedStore.string(SharedStore.activeGroupKey)]
        listId = preferred.compactMap { $0 }.first { id in lists.contains { $0.id == id } } ?? lists.first?.id
    }

    /// Loose name match: "Lucali" vs "Lucali Brooklyn", ignoring case, accents and punctuation.
    static func sameName(_ a: String, _ b: String) -> Bool {
        func norm(_ s: String) -> String {
            s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
                .components(separatedBy: CharacterSet.alphanumerics.inverted)
                .filter { !$0.isEmpty }
                .joined(separator: " ")
        }
        let x = norm(a), y = norm(b)
        return !x.isEmpty && !y.isEmpty && (x.contains(y) || y.contains(x))
    }

    /// "pizza_restaurant" → "Pizza", "coffee_shop" → "Coffee shop".
    static func typeLabel(_ type: String?) -> String? {
        guard let type, !type.isEmpty else { return nil }
        let words = type.replacingOccurrences(of: "_restaurant", with: "").replacingOccurrences(of: "_", with: " ")
        return words.prefix(1).uppercased() + words.dropFirst()
    }

    /// "PRICE_LEVEL_MODERATE" → "$$".
    static func priceLabel(_ level: String?) -> String? {
        switch level {
        case "PRICE_LEVEL_INEXPENSIVE": return "$"
        case "PRICE_LEVEL_MODERATE": return "$$"
        case "PRICE_LEVEL_EXPENSIVE": return "$$$"
        case "PRICE_LEVEL_VERY_EXPENSIVE": return "$$$$"
        default: return nil
        }
    }
}
