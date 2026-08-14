import { useState, useEffect } from "react";
import { Utensils, Plus, Users, ArrowRight, Camera } from "lucide-react";
import { supabase } from "../lib/supabase";
import { C } from "../constants/theme";

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [view, setView] = useState<"PROFILE" | "SELECT" | "CREATE" | "JOIN">("PROFILE");
  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Group Avatar Upload State
  const [groupAvatarUrl, setGroupAvatarUrl] = useState<string | null>(null);
  const [uploadingGroupAvatar, setUploadingGroupAvatar] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0 || !userId) return;
      setUploadingAvatar(true);
      setError(null);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId);
      setProfileUrl(data.publicUrl);
      
      // Auto-advance after 1.2 seconds so they can see their beautiful face load in!
      setTimeout(() => setView("SELECT"), 1200);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0 || !userId) return;
      setUploadingGroupAvatar(true);
      setError(null);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `group-${userId}-${Math.random()}.${fileExt}`;
      const filePath = `groups/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setGroupAvatarUrl(data.publicUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingGroupAvatar(false);
    }
  };

  const handleCreate = async () => {
    if (newGroupName.length < 3) return setError("Name must be at least 3 characters.");
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.rpc("create_group", { group_name: newGroupName });
    
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (groupAvatarUrl && userId) {
      // Patch the avatar into the newly generated group container!
      await supabase.from('groups').update({ avatar_url: groupAvatarUrl }).eq('name', newGroupName).eq('created_by', userId);
    }

    setLoading(false);
    onComplete(); // Immediately pass them into the Main App Shell!
  };

  const handleJoin = async () => {
    if (joinCode.length < 6) return setError("Code must be at least 6 characters.");
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.rpc("join_group", { invite_code: joinCode.toUpperCase() });
    setLoading(false);
    if (err) setError(err.message);
    else onComplete();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50 relative animate-in fade-in duration-300">
      <div className="flex-1 flex flex-col p-6 max-w-sm mx-auto w-full pt-20">
        
        {/* Core Header */}
        <div className="mb-12">
          <div className="w-14 h-14 rounded-[1.25rem] flex items-center justify-center mb-5 shadow-lg shadow-rose-200" style={{ background: C.rose }}>
            <Utensils size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight mb-2">
            Welcome to <br/>Crave.
          </h1>
          {view === "PROFILE" ? (
             <p className="text-base text-slate-500 font-medium">Add a profile picture so your friends can recognize you.</p>
          ) : (
             <p className="text-base text-slate-500 font-medium">Before we start saving spots, let's set up your first Cravelist.</p>
          )}
        </div>

        {view === "PROFILE" && (
          <div className="flex flex-col items-center animate-in slide-in-from-bottom-4 duration-300">
            {error && <p className="text-rose-500 text-sm font-bold text-center px-2 mb-4">{error}</p>}
            <label className="w-36 h-36 rounded-full mb-8 bg-white border-4 border-white flex items-center justify-center cursor-pointer overflow-hidden shadow-xl shadow-rose-200/50 relative group transition-all active:scale-95">
              {uploadingAvatar ? (
                <div className="animate-spin w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full" />
              ) : profileUrl ? (
                <img src={profileUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-rose-300">
                   <Camera size={32} strokeWidth={2.5} />
                   <span className="text-[10px] font-black tracking-wider uppercase">Upload Image</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingAvatar} />
            </label>

            <button onClick={() => setView("SELECT")}
              className="w-full py-4 rounded-2xl font-black text-rose-600 bg-rose-50 border border-rose-100 transition-all active:scale-95 text-[15px]">
              {profileUrl ? "Looks good! Continue" : "Skip for now"}
            </button>
          </div>
        )}

        {view === "SELECT" && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <button onClick={() => setView("CREATE")} className="w-full bg-white border border-slate-200 p-5 rounded-3xl flex items-center gap-4 active:scale-[0.98] transition-all shadow-sm">
              <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex flex-shrink-0 items-center justify-center">
                <Plus size={24} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-black text-slate-800 text-lg">Create New</h3>
                <p className="text-[13px] font-medium text-slate-500 mt-0.5">Start a fresh list for yourself or your friends.</p>
              </div>
            </button>

            <button onClick={() => setView("JOIN")} className="w-full bg-white border border-slate-200 p-5 rounded-3xl flex items-center gap-4 active:scale-[0.98] transition-all shadow-sm">
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex flex-shrink-0 items-center justify-center">
                <Users size={24} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-black text-slate-800 text-lg">Join Existing</h3>
                <p className="text-[13px] font-medium text-slate-500 mt-0.5">Have an invite code? Join a friend's list.</p>
              </div>
            </button>
          </div>
        )}

        {view === "CREATE" && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300 flex flex-col items-center">
            
            <label className="w-24 h-24 rounded-2xl mb-2 bg-white border-2 border-slate-200 border-dashed flex items-center justify-center cursor-pointer overflow-hidden shadow-sm relative group transition-all active:scale-95">
              {uploadingGroupAvatar ? (
                <div className="animate-spin w-6 h-6 border-4 border-rose-500 border-t-transparent rounded-full" />
              ) : groupAvatarUrl ? (
                <img src={groupAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-slate-400">
                   <Camera size={24} strokeWidth={2} />
                   <span className="text-[9px] font-black tracking-wider uppercase">Add Logo</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleGroupAvatarUpload} className="hidden" disabled={uploadingGroupAvatar} />
            </label>

            <div className="space-y-2 w-full">
              <label className="text-sm font-bold text-slate-700 ml-1">Name your Cravelist</label>
              <input type="text" placeholder="e.g. NYC Hitlist, Date Spots..." value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-slate-800 font-bold placeholder:text-slate-400 placeholder:font-medium outline-none focus:border-rose-400 transition-all text-lg text-center" />
            </div>
            {error && <p className="text-rose-500 text-sm font-bold text-center px-2">{error}</p>}
            
            <button onClick={handleCreate} disabled={loading || !newGroupName}
              className="w-full py-4 rounded-2xl font-black text-white text-[15px] disabled:opacity-40 transition-all shadow-lg flex items-center justify-center gap-2"
              style={{ background: C.rose, boxShadow: `0 10px 25px -5px ${C.rose}60` }}>
              {loading ? "Creating..." : "Create List"} <ArrowRight size={18} />
            </button>
            <button onClick={() => { setView("SELECT"); setError(null); }} className="w-full py-3 text-slate-400 font-bold text-sm">Back</button>
          </div>
        )}

        {view === "JOIN" && (
          <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Enter Invite Code</label>
              <input type="text" placeholder="SIX-DIGIT-CODE" value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-slate-800 font-black uppercase tracking-widest placeholder:text-slate-300 placeholder:font-medium outline-none focus:border-rose-400 transition-all text-lg text-center" />
            </div>
            {error && <p className="text-rose-500 text-sm font-bold text-center px-2">{error}</p>}
            
            <button onClick={handleJoin} disabled={loading || !joinCode}
              className="w-full py-4 rounded-2xl font-black text-white text-[15px] disabled:opacity-40 transition-all shadow-lg flex items-center justify-center gap-2"
              style={{ background: C.rose, boxShadow: `0 10px 25px -5px ${C.rose}60` }}>
              {loading ? "Joining..." : "Join List"} <ArrowRight size={18} />
            </button>
            <button onClick={() => { setView("SELECT"); setError(null); }} className="w-full py-3 text-slate-400 font-bold text-sm">Back</button>
          </div>
        )}

      </div>
    </div>
  );
}
