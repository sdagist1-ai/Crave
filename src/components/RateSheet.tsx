import { useState, useRef } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Camera, Utensils, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { C } from "../constants/theme";
import { Restaurant } from "../types";
import { ScoreRating } from "./ScoreRating";

// HTML5 Canvas Native Deep Compression Engine (Max 1280px / 82% JPEG Quality)
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const MAX_DIM = 1280;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_DIM) { height = Math.round((height * MAX_DIM) / width); width = MAX_DIM; }
        } else {
          if (height > MAX_DIM) { width = Math.round((width * MAX_DIM) / height); height = MAX_DIM; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() }));
        }, "image/jpeg", 0.82);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("partner_id").eq("id", user.id).single();
      return data;
    }
  });
  const verb = profileQuery.data?.partner_id ? "We" : "I";

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
    try {
      // 1. Permanently delete requested remote photos from the Supabase Disk Space specifically to save room natively
      if (deletedUrls.length > 0) {
        const fileNames = deletedUrls.map(url => {
          const parts = url.split("/photos/");
          return parts.length === 2 ? parts[1] : null;
        }).filter(Boolean) as string[];
        
        if (fileNames.length > 0) {
          console.log("Emptying from bucket...", fileNames);
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
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      // 3. Update or Insert into the dedicated reviews table
      const existingReview = restaurant.reviews?.find(r => r.user_id === user.id);
      
      let reqError;
      if (existingReview) {
        const { error } = await supabase
          .from("reviews")
          .update({
             score: score || null,
             notes: notes.trim() || null,
             photo_url: finalUrls.length > 0 ? finalUrls[0] : null,
             photo_urls: finalUrls.length > 0 ? finalUrls : null,
          })
          .eq("id", existingReview.id);
        reqError = error;
      } else {
        const { error } = await supabase
          .from("reviews")
          .insert({
             place_id: restaurant.placeId,
             user_id: user.id,
             score: score || null,
             notes: notes.trim() || null,
             photo_url: finalUrls.length > 0 ? finalUrls[0] : null,
             photo_urls: finalUrls.length > 0 ? finalUrls : null,
          });
        reqError = error;
      }

      if (reqError) throw reqError;
      
      // 4. Trigger the RPC to check and update the "visited" group consensus
      await supabase.rpc("check_and_update_visited_status", { p_restaurant_id: restaurant.id });
      
      queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      onClose();
    } catch (err) {
      console.error("RateSheet: save failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl p-6 pb-safe-or-6 bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-5" />
        <div className="flex items-center gap-3 mb-6">
          {restaurant.photoUrl ? (
            <img src={restaurant.photoUrl} alt={restaurant.name} className="w-14 h-14 rounded-2xl object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center"><Utensils size={20} className="text-rose-400" /></div>
          )}
          <div>
            <h3 className="font-bold text-slate-800 text-lg">{restaurant.name}</h3>
            <p className="text-sm text-slate-400">{restaurant.visited ? "Update your rating" : "How was it?"}</p>
          </div>
        </div>

        {/* Horizontal Scroll Multi-Photo Upload Area */}
        <div className="mb-5">
          <label className="flex items-center justify-between text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
            <span>Your Photos</span>
            <span className="text-slate-300 font-bold">{existingUrls.length + localFiles.length} selected</span>
          </label>
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoSelect} />
          
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-2 px-2">
            {/* The giant Add Photo Button */}
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 w-[120px] h-[160px] rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 active:bg-slate-50 transition-colors bg-white hover:border-slate-300">
              <Camera size={26} strokeWidth={1.5} />
              <span className="text-[11px] font-black uppercase tracking-wider text-center px-2 leading-tight">Add<br/>Photo</span>
            </button>
            
            {/* Existing Remote Previews */}
            {existingUrls.map(url => (
              <div key={url} className="relative flex-shrink-0 w-[120px] h-[160px] rounded-3xl overflow-hidden shadow-sm border border-slate-100 group">
                <img src={url} alt="Visit photo" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeExistingPhoto(url)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white scale-95 active:scale-90 transition-all border border-black/10">
                  <X size={14} strokeWidth={3} />
                </button>
              </div>
            ))}
            
            {/* New Local Previews */}
            {localFiles.map(local => (
              <div key={local.id} className="relative flex-shrink-0 w-[120px] h-[160px] rounded-3xl overflow-hidden shadow-md shadow-rose-100 border-2 border-rose-100 group">
                <img src={local.preview} alt="New upload" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeLocalPhoto(local.id)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white scale-95 active:scale-90 transition-all border border-black/10">
                  <X size={14} strokeWidth={3} />
                </button>
                <div className="absolute top-2 left-2 px-2 py-1 rounded bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider shadow-sm">New</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Thoughts?</label>
          <textarea 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you think of the food or vibe?"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 transition-all resize-none h-24"
          />
        </div>

        <div className="mb-6">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Score</label>
          <ScoreRating value={score} onChange={setScore} />
        </div>
        {score > 0 && (
          <div className="text-center mb-4">
            <span className="text-3xl font-black" style={{ color: score <= 3 ? C.rose : score <= 5 ? "#F97316" : score <= 7 ? C.amber : score <= 9 ? "#84CC16" : C.emerald }}>
              {score}
            </span>
            <span className="text-lg font-bold text-slate-300">/10</span>
          </div>
        )}
        <button type="button" onClick={handleSave} disabled={saving || uploading || score === 0}
          className="w-full py-4 rounded-2xl font-bold text-white text-sm disabled:opacity-40 transition-all shadow-lg shadow-rose-200"
          style={{ background: C.rose }}>
          {uploading ? "Uploading photo..." : saving ? "Saving..." : restaurant.visited ? "Update Rating" : `Mark as ${verb} Tried`}
        </button>
      </div>
    </div>
  );
}
