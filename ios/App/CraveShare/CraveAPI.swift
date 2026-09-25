import Foundation

// MARK: - Models (the shapes the app's `places` function and database return)

struct PlaceResult: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let address: String
    let lat: Double
    let lng: Double
    let primaryType: String?
    /// Google photo resource name, copied into Storage when the place is saved.
    let photoUrl: String?
    let city: String?
    let area: String?
    let countryCode: String?
    let rating: Double?
    let userRatingCount: Int?
    let priceLevel: String?
}

struct PlaceDetails: Decodable {
    let openingHours: [String]?
    let rating: Double?
    let userRatingCount: Int?
    let priceLevel: String?
}

struct SharedTarget: Decodable {
    let query: String
    let name: String
    let lat: Double?
    let lng: Double?
}

struct CraveList: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
}

enum CraveError: LocalizedError {
    case notSignedIn
    case alreadySaved
    case server(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Open Crave and sign in first."
        case .alreadySaved: return "It's already on that list."
        case .server(let message): return message
        }
    }
}

// MARK: - API

/// Talks to Supabase as the signed-in user, using the session the app keeps in the
/// shared App Group. Mirrors what the app does when you add a place.
final class CraveAPI {
    private struct Config: Decodable {
        let url: String
        let anonKey: String
        let storageKey: String
    }

    private let config: Config
    private let session = URLSession(configuration: .ephemeral)

    /// Nil when the app hasn't run (with this version) on this device yet.
    init?() {
        guard let raw = SharedStore.string(SharedStore.configKey),
              let data = raw.data(using: .utf8),
              let config = try? JSONDecoder().decode(Config.self, from: data),
              URL(string: config.url) != nil
        else { return nil }
        self.config = config
    }

    // MARK: Session

    /// A valid access token. Call it once up front: later calls then find a fresh
    /// token and never refresh concurrently. Refreshes the shared session when it's about to expire
    /// (the app is in the background while the share sheet is open, so only one of
    /// the two ever refreshes at a time) and stores the new tokens for the app.
    func accessToken() async throws -> String {
        guard let raw = SharedStore.string(config.storageKey),
              let stored = try? JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any],
              let accessToken = stored["access_token"] as? String,
              let refreshToken = stored["refresh_token"] as? String
        else { throw CraveError.notSignedIn }

        let expiresAt = (stored["expires_at"] as? NSNumber)?.doubleValue ?? 0
        if expiresAt - Date().timeIntervalSince1970 > 120 { return accessToken }

        var request = URLRequest(url: endpoint("auth/v1/token", query: [URLQueryItem(name: "grant_type", value: "refresh_token")]))
        request.httpMethod = "POST"
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        // 400/401: the session was revoked or signed out elsewhere.
        if status == 400 || status == 401 { throw CraveError.notSignedIn }
        guard (200..<300).contains(status),
              var fresh = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let newToken = fresh["access_token"] as? String,
              fresh["refresh_token"] is String
        else { throw CraveError.server("Couldn't reach Crave. Check your connection and try again.") }

        // Store it the way supabase-js does (it needs expires_at).
        if fresh["expires_at"] == nil, let expiresIn = (fresh["expires_in"] as? NSNumber)?.doubleValue {
            fresh["expires_at"] = Int(Date().timeIntervalSince1970 + expiresIn)
        }
        if let json = try? JSONSerialization.data(withJSONObject: fresh),
           let string = String(data: json, encoding: .utf8) {
            SharedStore.set(string, config.storageKey)
        }
        return newToken
    }

    // MARK: Places (the app's `places` Edge Function)

    func resolveShare(url: String?, text: String?) async throws -> SharedTarget {
        var body: [String: Any] = ["action": "resolve_share"]
        if let url { body["url"] = url }
        if let text { body["text"] = text }
        return try await callPlaces(body)
    }

    func search(_ query: String, near target: SharedTarget) async throws -> [PlaceResult] {
        var body: [String: Any] = ["action": "search", "query": query]
        if let lat = target.lat, let lng = target.lng { body["lat"] = lat; body["lng"] = lng }
        struct Results: Decodable { let places: [PlaceResult] }
        let results: Results = try await callPlaces(body)
        return results.places
    }

    func details(placeId: String) async throws -> PlaceDetails {
        try await callPlaces(["action": "details", "placeId": placeId])
    }

    /// Copies the place's Google photo into Storage; nil if that fails (saves without a photo, like the app).
    func cachePhoto(photoName: String, placeId: String) async -> String? {
        struct Photo: Decodable { let url: String }
        let photo: Photo? = try? await callPlaces(["action": "photo", "photoName": photoName, "placeId": placeId])
        return photo?.url
    }

    // MARK: Database

    func myLists() async throws -> [CraveList] {
        let data = try await send(path: "rest/v1/rpc/get_my_groups", body: [String: Any]())
        return try JSONDecoder().decode([CraveList].self, from: data)
    }

    /// Adds the place to a list, with the same fields the app saves.
    func save(place: PlaceResult, details: PlaceDetails?, photoUrl: String?, listId: String,
              vibes: [String], notes: String) async throws {
        func orNull<T>(_ value: T?) -> Any { value.map { $0 as Any } ?? NSNull() }
        let row: [String: Any] = [
            "group_id": listId,
            "place_id": place.id,
            "name": place.name,
            "address": place.address,
            "city": orNull(place.city),
            "area": orNull(place.area),
            "country_code": orNull(place.countryCode),
            "latitude": place.lat,
            "longitude": place.lng,
            "rating": orNull(details?.rating ?? place.rating),
            "user_rating_count": orNull(details?.userRatingCount ?? place.userRatingCount),
            "price_level": orNull(details?.priceLevel ?? place.priceLevel),
            "primary_type": orNull(place.primaryType),
            "photo_url": orNull(photoUrl),
            "vibes": vibes,
            "notes": notes,
            "last_synced_at": ISO8601DateFormatter().string(from: Date()),
            "opening_hours": orNull(details?.openingHours),
        ]
        _ = try await send(path: "rest/v1/restaurants", body: row, headers: ["Prefer": "return=minimal"])
    }

    // MARK: Plumbing

    private func callPlaces<T: Decodable>(_ body: [String: Any]) async throws -> T {
        let data = try await send(path: "functions/v1/places", body: body)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func send(path: String, body: Any, headers: [String: String] = [:]) async throws -> Data {
        let token = try await accessToken()
        var request = URLRequest(url: endpoint(path))
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        headers.forEach { request.setValue($1, forHTTPHeaderField: $0) }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let result: (Data, URLResponse)
        do {
            result = try await session.data(for: request)
        } catch {
            throw CraveError.server("Couldn't reach Crave. Check your connection and try again.")
        }
        let (data, response) = result
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if (200..<300).contains(status) { return data }
        if status == 401 { throw CraveError.notSignedIn }
        // Unique (group_id, place_id): the place is already on this list.
        if status == 409 || String(data: data, encoding: .utf8)?.contains("23505") == true { throw CraveError.alreadySaved }
        // resolve_share: the link and text didn't name a place.
        if status == 422 { throw CraveError.server("Couldn't tell which place that is. Open Crave to search for it.") }
        throw CraveError.server("Something went wrong (\(status)). Try again, or open Crave.")
    }

    private func endpoint(_ path: String, query: [URLQueryItem] = []) -> URL {
        var components = URLComponents(string: config.url)!
        components.path = "/" + path
        if !query.isEmpty { components.queryItems = query }
        return components.url!
    }
}
