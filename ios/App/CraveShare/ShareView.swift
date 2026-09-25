import SwiftUI

/// Crave's colours (same values as the app's theme).
private enum Palette {
    static let accent = Color(red: 1.0, green: 0.271, blue: 0.227)        // #FF453A
    static let accentInk = Color(red: 0.761, green: 0.149, blue: 0.110)   // #C2261C
    static let accentTint = Color(red: 1.0, green: 0.894, blue: 0.882)    // #FFE4E1
    static let ink = Color(red: 0.059, green: 0.090, blue: 0.165)         // #0F172A
    static let muted = Color(red: 0.392, green: 0.455, blue: 0.545)       // #64748B
    static let faint = Color(red: 0.580, green: 0.639, blue: 0.722)       // #94A3B8
    static let border = Color(red: 0.886, green: 0.910, blue: 0.941)      // #E2E8F0
    static let subtle = Color(red: 0.945, green: 0.961, blue: 0.976)      // #F1F5F9
    static let background = Color(red: 0.973, green: 0.980, blue: 0.988)  // #F8FAFC
    static let success = Color(red: 0.063, green: 0.725, blue: 0.506)     // #10B981
}

struct ShareView: View {
    @ObservedObject var model: ShareModel
    @FocusState private var noteFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            Rectangle().fill(Palette.border).frame(height: 1)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .background(Palette.background.ignoresSafeArea())
        .preferredColorScheme(.light)
        .task { await model.start() }
    }

    private var header: some View {
        ZStack {
            HStack(spacing: 8) {
                Image(systemName: "fork.knife")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 24, height: 24)
                    .background(Circle().fill(Palette.accent))
                Text("Add to Crave")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundColor(Palette.ink)
            }
            HStack {
                Button { model.finish() } label: {
                    Text("Cancel")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(Palette.muted)
                        .padding(.vertical, 8)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Spacer()
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    @ViewBuilder private var content: some View {
        switch model.phase {
        case .loading(let message):
            status(icon: nil, title: message, detail: nil)
        case .needsSignIn:
            status(icon: "person.crop.circle.badge.exclamationmark",
                   title: "Sign in to Crave first",
                   detail: "Open Crave, sign in, then share the place again.",
                   action: ("Open Crave", model.openInApp))
        case .failed(let message):
            status(icon: "mappin.slash", title: "Hmm, that didn't work", detail: message,
                   action: ("Open in Crave", model.openInApp))
        case .choose(let results):
            chooser(results)
        case .ready, .saving:
            form
        case .saved(let listName):
            status(icon: "checkmark.circle.fill", title: "Saved to \(listName)", detail: nil)
        }
    }

    // MARK: Pick the right place when the match wasn't certain

    private func chooser(_ results: [PlaceResult]) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("Which one did you mean?")
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundColor(Palette.ink)
                    .padding(.horizontal, 20)
                    .padding(.top, 20)
                    .padding(.bottom, 8)
                ForEach(results) { result in
                    Button { model.select(result) } label: {
                        HStack(spacing: 14) {
                            tile(result.name, size: 48)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(result.name).font(.system(size: 16, weight: .semibold)).foregroundColor(Palette.ink)
                                Text(street(result) ?? result.address).font(.system(size: 13)).foregroundColor(Palette.muted)
                            }
                            .lineLimit(1)
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(Palette.faint)
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Rectangle().fill(Palette.border).frame(height: 1).padding(.leading, 82)
                }
                Button(action: model.openInApp) {
                    Text("Not here? Search in Crave")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(Palette.accentInk)
                        .padding(20)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: The add form

    @ViewBuilder private var form: some View {
        if let place = model.place {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        placeCard(place)

                        // Which list
                        field("List") {
                            Menu {
                                ForEach(model.lists) { list in
                                    Button {
                                        model.listId = list.id
                                    } label: {
                                        if list.id == model.listId { Label(list.name, systemImage: "checkmark") } else { Text(list.name) }
                                    }
                                }
                            } label: {
                                HStack {
                                    Text(model.listName)
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundColor(Palette.ink)
                                        .lineLimit(1)
                                    Spacer()
                                    if model.lists.count > 1 {
                                        Image(systemName: "chevron.up.chevron.down")
                                            .font(.system(size: 13, weight: .semibold))
                                            .foregroundColor(Palette.muted)
                                    }
                                }
                                .padding(.horizontal, 16)
                                .frame(height: 52)
                                .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Palette.border))
                                .contentShape(Rectangle())
                            }
                            .plainMenu()
                            .disabled(model.lists.count < 2)
                        }

                        // Vibe
                        field("Vibe") {
                            HStack(spacing: 10) {
                                ForEach(ShareModel.vibeOptions, id: \.self) { vibe in
                                    vibeChip(vibe)
                                }
                            }
                        }

                        // Note
                        field("Why this spot?", optional: true) {
                            TextField("Heard the brunch is unreal…", text: $model.note)
                                .focused($noteFocused)
                                .submitLabel(.done)
                                .onSubmit { noteFocused = false }
                                .font(.system(size: 16))
                                .foregroundColor(Palette.ink)
                                .accentColor(Palette.accent)
                                .padding(.horizontal, 16)
                                .frame(height: 52)
                                .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                                .overlay(RoundedRectangle(cornerRadius: 16).stroke(noteFocused ? Palette.accent : Palette.border))
                        }
                    }
                    .padding(20)
                }

                saveBar
            }
        }
    }

    private func placeCard(_ place: PlaceResult) -> some View {
        HStack(alignment: .top, spacing: 14) {
            tile(place.name, size: 56)
            VStack(alignment: .leading, spacing: 6) {
                Text(place.name)
                    .font(.system(size: 21, weight: .heavy))
                    .foregroundColor(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if let subtitle = subtitle(place) {
                    Text(subtitle).font(.system(size: 14, weight: .medium)).foregroundColor(Palette.muted)
                }
                if let street = street(place) {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse").font(.system(size: 11, weight: .semibold))
                        Text(street).lineLimit(1)
                    }
                    .font(.system(size: 13))
                    .foregroundColor(Palette.faint)
                }
                let rating = model.details?.rating ?? place.rating
                let price = ShareModel.priceLabel(model.details?.priceLevel ?? place.priceLevel)
                if rating != nil || price != nil {
                    HStack(spacing: 6) {
                        if let rating {
                            chip("★ \(String(format: "%.1f", rating))",
                                 fill: Color(red: 1.0, green: 0.953, blue: 0.78),
                                 text: Color(red: 0.573, green: 0.251, blue: 0.055))
                        }
                        if let price {
                            chip(price, fill: Palette.subtle, text: Palette.ink)
                        }
                    }
                    .padding(.top, 2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 22).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(Palette.border))
    }

    private func vibeChip(_ vibe: String) -> some View {
        let on = model.vibes.contains(vibe)
        return Button { model.toggle(vibe) } label: {
            HStack(spacing: 6) {
                Image(systemName: vibe == "Elegant" ? "sparkles" : "cup.and.saucer")
                    .font(.system(size: 14, weight: .semibold))
                Text(vibe).font(.system(size: 15, weight: .semibold))
            }
            .foregroundColor(on ? Palette.accentInk : Palette.ink)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(RoundedRectangle(cornerRadius: 16).fill(on ? Palette.accentTint : Color.white))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(on ? Palette.accent : Palette.border, lineWidth: on ? 1.5 : 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Stays above the keyboard and the fold, so Save is always in reach.
    private var saveBar: some View {
        VStack(spacing: 8) {
            if let error = model.saveError {
                Text(error)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Palette.accentInk)
                    .multilineTextAlignment(.center)
            }
            Button {
                noteFocused = false
                Task { await model.save() }
            } label: {
                HStack(spacing: 8) {
                    if model.phase == .saving { ProgressView().tint(.white) }
                    Text(model.phase == .saving ? "Saving…" : "Save to \(model.listName)")
                        .font(.system(size: 17, weight: .bold))
                        .lineLimit(1)
                }
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity)
                .frame(height: 56)
                .background(RoundedRectangle(cornerRadius: 18).fill(Palette.accent.opacity(model.canSave || model.phase == .saving ? 1 : 0.35)))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!model.canSave)

            if model.vibes.isEmpty {
                Text("Pick a vibe to save")
                    .font(.system(size: 13))
                    .foregroundColor(Palette.muted)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 12)
        .background(
            Color.white
                .overlay(Rectangle().fill(Palette.border).frame(height: 1), alignment: .top)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    // MARK: Pieces

    private func status(icon: String?, title: String, detail: String?, action: (String, () -> Void)? = nil) -> some View {
        VStack(spacing: 12) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundColor(icon == "checkmark.circle.fill" ? Palette.success : Palette.accent)
                    .frame(width: 72, height: 72)
                    .background(Circle().fill(icon == "checkmark.circle.fill" ? Palette.success.opacity(0.12) : Palette.accentTint))
                    .padding(.bottom, 4)
            } else {
                ProgressView().scaleEffect(1.3).tint(Palette.accent).padding(.bottom, 6)
            }
            Text(title)
                .font(.system(size: 19, weight: .bold))
                .foregroundColor(Palette.ink)
                .multilineTextAlignment(.center)
            if let detail {
                Text(detail)
                    .font(.system(size: 15))
                    .foregroundColor(Palette.muted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let action {
                Button(action: action.1) {
                    Text(action.0)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 28)
                        .frame(height: 50)
                        .background(Capsule().fill(Palette.ink))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .padding(.top, 8)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity)
        .padding(.top, 40)
    }

    private func field<Content: View>(_ title: String, optional: Bool = false, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(title).font(.system(size: 13, weight: .semibold)).foregroundColor(Palette.muted)
                if optional {
                    Text("Optional").font(.system(size: 12)).foregroundColor(Palette.faint)
                }
            }
            content()
        }
    }

    private func tile(_ name: String, size: CGFloat) -> some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.system(size: size * 0.42, weight: .heavy))
            .foregroundColor(Palette.accentInk)
            .frame(width: size, height: size)
            .background(RoundedRectangle(cornerRadius: size * 0.3).fill(Palette.accentTint))
    }

    private func chip(_ text: String, fill: Color, text textColor: Color) -> some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(textColor)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Capsule().fill(fill))
    }

    private func subtitle(_ place: PlaceResult) -> String? {
        let parts = [ShareModel.typeLabel(place.primaryType), place.area].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// "575 Henry St, Brooklyn, NY 11231, USA" → "575 Henry St".
    private func street(_ place: PlaceResult) -> String? {
        let first = place.address.split(separator: ",").first.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
        return first.isEmpty ? nil : first
    }
}

private extension View {
    /// Menus draw their label as-is (iOS 26 otherwise wraps it in a glass ring).
    @ViewBuilder func plainMenu() -> some View {
        if #available(iOS 16.0, *) {
            self.menuStyle(.button).buttonStyle(.plain)
        } else {
            self.menuStyle(.borderlessButton)
        }
    }
}
