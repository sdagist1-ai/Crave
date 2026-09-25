import Foundation

/// The bits of a shared contact card (vCard) that identify a place: Apple Maps
/// shares one with the place's name, address and a maps link.
struct VCardPlace {
    var name: String?
    var address: String?
    var mapsLink: String?

    init(_ vcard: String) {
        // Long lines are folded onto the next line, which then starts with a space.
        let unfolded = vcard
            .replacingOccurrences(of: "\r\n ", with: "")
            .replacingOccurrences(of: "\n ", with: "")
        var fullName: String?
        var organisation: String?

        for line in unfolded.components(separatedBy: .newlines) {
            guard let colon = line.firstIndex(of: ":") else { continue }
            // "item1.ADR;type=WORK" → "ADR"
            let head = line[..<colon].split(separator: ";").first ?? ""
            let property = (head.split(separator: ".").last ?? "").uppercased()
            let value = String(line[line.index(after: colon)...])

            switch property {
            case "FN":
                fullName = fullName ?? Self.unescape(value)
            case "ORG":
                organisation = organisation ?? value.components(separatedBy: ";").first.map(Self.unescape)
            case "ADR":
                // ;;street;city;region;postcode;country
                guard address == nil else { break }
                let parts = value.components(separatedBy: ";").map(Self.unescape)
                let street = parts.count > 2 ? parts[2] : ""
                let city = parts.count > 3 ? parts[3] : ""
                let joined = [street, city].filter { !$0.isEmpty }.joined(separator: ", ")
                address = joined.isEmpty ? nil : joined
            case "URL":
                let link = Self.unescape(value)
                if mapsLink == nil, link.contains("maps.apple") || link.contains("google.") || link.contains("goo.gl") {
                    mapsLink = link
                }
            default:
                break
            }
        }
        name = [fullName, organisation].compactMap { $0 }.first { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    /// vCard escapes: "\," "\;" "\:" "\n".
    private static func unescape(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\\n", with: " ")
            .replacingOccurrences(of: "\\N", with: " ")
            .replacingOccurrences(of: "\\,", with: ",")
            .replacingOccurrences(of: "\\;", with: ";")
            .replacingOccurrences(of: "\\:", with: ":")
            .trimmingCharacters(in: .whitespaces)
    }
}
