import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, X } from "lucide-react";
import { getCurrentUserId, supabase } from "../lib/supabase";
import type { Restaurant } from "../types";
import { ScoreRating } from "./ScoreRating";
import { PrimaryButton, Sheet } from "./ui";
import { compressImage } from "../lib/images";

async function uploadVisitPhoto(file: File): Promise<string> {
  const compressed = await compressImage(file);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase.storage.from("photos").upload(fileName, compressed);
  if (error) throw error;
  const { data } = supabase.storage.from("photos").getPublicUrl(fileName);
  return data.publicUrl;
}

export function RateSheet({ restaurant, onClose }: { restaurant: Restaurant; onClose: () => void }) {
  const [score, setScore] = useState(restaurant.userScore || 0);
  const [notes, setNotes] = useState(restaurant.notes || "");
  
  // Migrate legacy single strings to the new array standard dynamically without crashing
  const defaultUrls = restaurant.visitPhotoUrls?.length > 0 ? restaurant.visitPhotoUrls : (restaurant.visitPhotoUrl ? [restaurant.visitPhotoUrl] : []);
  
  const [existingUrls, setExistingUrls] = useState<string[]>(defaultUrls);
  const [deletedUrls, setDeletedUrls] = useState<string[]>([]);
  const [localFiles, setLocalFiles] = useState<{ id: string, file: File, preview: string }[]>([]);
  
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();


  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    // Convert all selected files into local blob previews seamlessly
    const newLocalFiles = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file)
    }));
    
    setLocalFiles(prev => [...prev, ...newLocalFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const removeExistingPhoto = (url: string) => {
    setExistingUrls(prev => prev.filter(u => u !== url));
    setDeletedUrls(prev => [...prev, url]);
  };
  
  const removeLocalPhoto = (id: string) => {
    setLocalFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // 1. Permanently delete requested remote photos from the Supabase Disk Space specifically to save room natively
      if (deletedUrls.length > 0) {
        const fileNames = deletedUrls.map(url => {
          const parts = url.split("/photos/");
          return parts.length === 2 ? parts[1] : null;
        }).filter(Boolean) as string[];
        
        if (fileNames.length > 0) {
          await supabase.storage.from("photos").remove(fileNames);
        }
      }

      // 2. Upload any brand new local camera roll photos
      const newUploadedUrls: string[] = [];
      if (localFiles.length > 0) {
        setUploading(true);
        for (const local of localFiles) {
          try {
            const url = await uploadVisitPhoto(local.file);
            newUploadedUrls.push(url);
          } catch (e) {
            console.error("Upload failed", e);
          }
        }
        setUploading(false);
      }

      const finalUrls = [...existingUrls, ...newUploadedUrls];
      
      const userId = await getCurrentUserId();
      if (!userId) throw new Error("Not logged in");

      // 3. One review per user per place (unique in the database), so upsert.
      // The database marks the restaurant as tried once a member has reviewed it.
      const { error: reqError } = await supabase
        .from("reviews")
        .upsert(
          {
            place_id: restaurant.placeId,
            user_id: userId,
            score: score || null,
            notes: notes.trim() || null,
            photo_url: finalUrls.length > 0 ? finalUrls[0] : null,
            photo_urls: finalUrls.length > 0 ? finalUrls : null,
          },
          { onConflict: "user_id,place_id" }
        );

      if (reqError) throw reqError;
      
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      onClose();
    } catch (err) {
      console.error("RateSheet: save failed", err);
      setError("Couldn't save your rating. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const photoCount = existingUrls.length + localFiles.length;
  const isEdit = restaurant.userScore != null;

  return (
    <Sheet onClose={onClose} labelledBy="rate-title">
      <div className="mb-5 flex items-center gap-3">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-subtle">
          {restaurant.photoUrl && <img src={restaurant.photoUrl} alt="" className="h-full w-full object-cover" />}
        </span>
        <div className="min-w-0">
          <h2 id="rate-title" className="m-0 truncate font-display text-2xl font-bold tracking-[-0.02em]">{restaurant.name}</h2>
          <p className="m-0 text-sm text-muted">{isEdit ? "Update your rating" : "How was it?"}</p>
        </div>
      </div>

      <fieldset className="m-0 mb-5 border-0 p-0">
        <legend className="mb-2.5 text-[13px] font-medium text-ink-2">Your score</legend>
        <ScoreRating value={score} onChange={setScore} />
      </fieldset>

      <label className="mb-5 block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you order? Would you go back?"
          rows={3}
          className="w-full resize-none rounded-2xl border border-border bg-surface p-3.5 text-[15px] outline-none placeholder:text-muted focus:border-accent"
        />
      </label>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-[13px] font-medium text-ink-2">
          <span>Photos</span>
          {photoCount > 0 && <span className="font-mono text-xs text-muted">{photoCount}</span>}
        </div>
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoSelect} />
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border-strong text-muted">
            <Camera size={20} />
            <span className="text-[11px] font-medium">Add</span>
          </button>
          {existingUrls.map((url) => (
            <Thumb key={url} src={url} onRemove={() => removeExistingPhoto(url)} />
          ))}
          {localFiles.map((local) => (
            <Thumb key={local.id} src={local.preview} onRemove={() => removeLocalPhoto(local.id)} />
          ))}
        </div>
      </div>

      {error && <p role="alert" className="m-0 mb-3 text-center text-sm font-medium text-danger">{error}</p>}

      <div className="pb-2">
        <PrimaryButton onClick={handleSave} disabled={saving || uploading || score === 0}
          tone={score > 0 ? "accent" : "ink"}>
          {(saving || uploading) && <Loader2 size={18} className="animate-spin" />}
          {uploading ? "Uploading photos…" : saving ? "Saving…" : score === 0 ? "Pick a score" : isEdit ? "Save changes" : "Mark as tried"}
        </PrimaryButton>
      </div>
    </Sheet>
  );
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-subtle">
      <img src={src} alt="" className="h-full w-full object-cover" />
      <button type="button" onClick={onRemove} aria-label="Remove photo"
        className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-white">
        <X size={14} />
      </button>
    </span>
  );
}
