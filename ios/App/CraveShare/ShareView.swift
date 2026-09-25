import SwiftUI

/// Crave's colours (same values as the app's theme).
private enum Palette {
    static let accent = Color(red: 1.0, green: 0.271, blue: 0.227)        // #FF453A
    static let accentInk = Color(red: 0.761, green: 0.149, blue: 0.110)   // #C2261C
    static let accentTint = Color(red: 1.0, green: 0.894, blue: 0.882)    // #FFE4E1
    static let ink = Color(red: 0.059, green: 0.090, blue: 0.165)         // #0F172A
    static let muted = Color(red: 0.392, green: 0.455, blue: 0.545)       // #64748B
    static let border = Color(red: 0.886, green: 0.910, blue: 0.941)      // #E2E8F0
    static let subtle = Color(red: 0.945, green: 0.961, blue: 0.976)      // #F1F5F9
    static let background = Color(red: 0.973, green: 0.980, blue: 0.988)  // #F8FAFC
}

struct ShareView: View {
    @ObservedObject var model: ShareModel
    @FocusState private var noteFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().overlay(Palette.border)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .background(Palette.background.ignoresSafeArea())
        .preferredColorScheme(.light)
        .task { await model.start() }
    }

    private var header: some View {
        HStack {
            Button("Cancel") { model.finish() }
                .foregroundColor(Palette.ink)
            Spacer()
            Text("Add to Crave").font(.system(size: 17, weight: .bold))
            Spacer()
            // Balances the Cancel button so the title stays centred.
            Text("Cancel").hidden()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
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
                            tile(result.name)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(result.name).font(.system(size: 16, weight: .semibold)).foregroundColor(Palette.ink)
                                Text(subtitle(result) ?? result.address).font(.system(size: 13)).foregroundColor(Palette.muted)
                            }
                            .lineLimit(1)
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(Palette.border).padding(.leading, 82)
                }
                Button("Not here? Search in Crave", action: model.openInApp)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(Palette.accentInk)
                    .padding(20)
            }
        }
    }

    // MARK: The add form

    @ViewBuilder private var form: some View {
        if let place = model.place {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    // The place
                    HStack(alignment: .top, spacing: 14) {
                        tile(place.name)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(place.name)
                                .font(.system(size: 24, weight: .heavy))
                                .foregroundColor(Palette.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            if let subtitle = subtitle(place) {
                                Text(subtitle).font(.system(size: 14)).foregroundColor(Palette.muted)
                            }
                            HStack(spacing: 6) {
                                if let rating = model.details?.rating ?? place.rating {
                                    chip("★ \(String(format: "%.1f", rating))", fill: Color(red: 1.0, green: 0.953, blue: 0.78), text: Color(red: 0.573, green: 0.251, blue: 0.055))
                                }
                                if let price = ShareModel.priceLabel(model.details?.priceLevel ?? place.priceLevel) {
                                    chip(price, fill: Palette.subtle, text: Palette.ink)
                                }
                            }
                        }
                    }

                    // Which list
                    VStack(alignment: .leading, spacing: 8) {
                        label("List")
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
                                Text(model.listName).font(.system(size: 16, weight: .semibold)).foregroundColor(Palette.ink)
                                Spacer()
                                Image(systemName: "chevron.up.chevron.down").font(.system(size: 13, weight: .semibold)).foregroundColor(Palette.muted)
                            }
                            .padding(.horizontal, 16)
                            .frame(height: 50)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Palette.border))
                        }
                        .disabled(model.lists.count < 2)
                    }

                    // Vibe
                    VStack(alignment: .leading, spacing: 8) {
                        label("Vibe")
                        HStack(spacing: 8) {
                            ForEach(ShareModel.vibeOptions, id: \.self) { vibe in
                                let on = model.vibes.contains(vibe)
                                Button { model.toggle(vibe) } label: {
                                    Text(vibe)
                                        .font(.system(size: 15, weight: on ? .semibold : .regular))
                                        .foregroundColor(on ? Palette.accentInk : Palette.ink)
                                        .padding(.horizontal, 18)
                                        .frame(height: 42)
                                        .background(Capsule().fill(on ? Palette.accentTint : Color.white))
                                        .overlay(Capsule().stroke(on ? Palette.accent : Palette.border, lineWidth: on ? 1.5 : 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    // Note
                    VStack(alignment: .leading, spacing: 8) {
                        label("Why this spot?")
                        TextField("Heard the brunch is unreal…", text: $model.note)
                            .focused($noteFocused)
                            .submitLabel(.done)
                            .onSubmit { noteFocused = false }
                            .font(.system(size: 16))
                            .padding(.horizontal, 16)
                            .frame(height: 50)
                            .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Palette.border))
                    }

                    if let error = model.saveError {
                        Text(error).font(.system(size: 14, weight: .medium)).foregroundColor(Palette.accentInk)
                    }

                    // Save
                    VStack(spacing: 10) {
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
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(RoundedRectangle(cornerRadius: 18).fill(Palette.accent.opacity(model.canSave || model.phase == .saving ? 1 : 0.4)))
                        }
                        .buttonStyle(.plain)
                        .disabled(!model.canSave)

                        Text(model.vibes.isEmpty ? "Pick a vibe to save" : " ")
                            .font(.system(size: 13))
                            .foregroundColor(Palette.muted)
                    }
                }
                .padding(20)
            }
        }
    }

    // MARK: Pieces

    private func status(icon: String?, title: String, detail: String?, action: (String, () -> Void)? = nil) -> some View {
        VStack(spacing: 12) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundColor(icon == "checkmark.circle.fill" ? Color(red: 0.063, green: 0.725, blue: 0.506) : Palette.accent)
            } else {
                ProgressView().scaleEffect(1.3).tint(Palette.accent)
            }
            Text(title)
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(Palette.ink)
                .multilineTextAlignment(.center)
            if let detail {
                Text(detail)
                    .font(.system(size: 15))
                    .foregroundColor(Palette.muted)
                    .multilineTextAlignment(.center)
            }
            if let action {
                Button(action.0, action: action.1)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .frame(height: 48)
                    .background(Capsule().fill(Palette.ink))
                    .padding(.top, 6)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity)
        .padding(.top, 40)
    }

    private func tile(_ name: String) -> some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.system(size: 20, weight: .heavy))
            .foregroundColor(Palette.accentInk)
            .frame(width: 48, height: 48)
            .background(RoundedRectangle(cornerRadius: 14).fill(Palette.accentTint))
    }

    private func chip(_ text: String, fill: Color, text textColor: Color) -> some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(textColor)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Capsule().fill(fill))
    }

    private func label(_ text: String) -> some View {
        Text(text).font(.system(size: 13, weight: .semibold)).foregroundColor(Palette.muted)
    }

    private func subtitle(_ place: PlaceResult) -> String? {
        let parts = [ShareModel.typeLabel(place.primaryType), place.area].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
