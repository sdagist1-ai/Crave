import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Group, Profile } from "../types";

const getColor = (str: string) => {
  const colors = ["#ff453a", "#ff9f0a", "#32ade6", "#0a84ff", "#af52de", "#ff375f", "#34c759"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (fName: string | null, lName: string | null) => {
  if (!fName && !lName) return "?";
  return `${fName?.charAt(0) || ""}${lName?.charAt(0) || ""}`.toUpperCase();
};

export function ProfileTab() {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploadingGroupAvatarId, setUploadingGroupAvatarId] = useState<string | null>(null);

  const [errorModalMsg, setErrorModalMsg] = useState<string | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      if (!profile) return;
      setUploadingAvatar(true);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
      
      setProfile({ ...profile, avatar_url: data.publicUrl });
      loadData();
    } catch (err: any) {
      setErrorModalMsg(err.message || "An error occurred");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleGroupAvatarUpload = async (groupId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0 || !profile) return;
      setUploadingGroupAvatarId(groupId);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `group-${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `groups/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      const { error: updateError } = await supabase.from('groups').update({ avatar_url: data.publicUrl }).eq('id', groupId);
      if (updateError) throw updateError;
      
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      loadData();
    } catch (err: any) {
      setErrorModalMsg(err.message || "An error occurred");
    } finally {
      setUploadingGroupAvatarId(null);
    }
  };

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, groupsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("groups").select("*, group_members(profiles(*))").order("created_at", { ascending: true })
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (groupsRes.data) setGroups(groupsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleJoin = async () => {
    if (joinCode.length < 6) return setErrorModalMsg("Code must be at least 6 characters.");
    setJoining(true);
    const { error } = await supabase.rpc("join_group", { invite_code: joinCode.toUpperCase() });
    setJoining(false);
    if (error) setErrorModalMsg(error.message);
    else { setJoinCode(""); loadData(); }
  };

  const handleCreate = async () => {
    if (newGroupName.length < 3) return setErrorModalMsg("Name too short.");
    setCreating(true);
    const { error } = await supabase.rpc("create_group", { group_name: newGroupName });
    setCreating(false);
    if (error) setErrorModalMsg(error.message);
    else { setNewGroupName(""); loadData(); }
  };

  const handleSignOut = async () => {
    queryClient.clear();
    await supabase.auth.signOut();
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    const { error } = await supabase.rpc("delete_user_account");
    if (error) {
      setErrorModalMsg(error.message);
      setDeleting(false);
    } else {
      await handleSignOut();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Icon icon="solar:spinner-broken-linear" className="animate-spin text-primary size-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <main className="flex-1 overflow-y-auto pb-32 px-4 pt-16">
        
        {/* Profile Card */}
        <div className="bg-card rounded-[2.5rem] p-8 border border-border/50 shadow-sm flex flex-col items-center mb-10">
          <label className="relative mb-4 cursor-pointer group">
            <div className="w-24 h-24 rounded-full border-4 border-background shadow-md overflow-hidden bg-secondary flex items-center justify-center">
              {uploadingAvatar ? (
                <Icon icon="solar:spinner-broken-linear" className="animate-spin text-primary size-8" />
              ) : profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Icon icon="solar:user-bold" className="text-muted-foreground size-12" />
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <Icon icon="solar:camera-linear" className="text-white size-8" />
            </div>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingAvatar} />
          </label>
          <h2 className="font-heading text-2xl font-bold">
            {profile?.first_name ? `Hi, ${profile.first_name}!` : "My Profile"}
          </h2>
        </div>

        {/* Cravelists */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Icon icon="solar:users-group-rounded-bold" className="text-primary size-5" />
            <h3 className="font-heading text-lg font-bold">My Cravelists</h3>
          </div>
          
          <div className="space-y-4">
            {groups.map(g => (
              <div key={g.id} className="bg-card rounded-[1.5rem] p-4 border border-border/50 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <label className="relative group w-16 h-16 rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden shadow-sm flex-shrink-0 bg-secondary" style={!g.avatar_url ? { background: getColor(g.name) } : {}}>
                    {uploadingGroupAvatarId === g.id ? (
                      <Icon icon="solar:spinner-broken-linear" className="animate-spin text-white size-6" />
                    ) : g.avatar_url ? (
                      <img src={g.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-black text-white/90">
                        {getInitials(g.name, null).replace("?", "✨")}
                      </span>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <Icon icon="solar:camera-linear" className="text-white size-6" />
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => handleGroupAvatarUpload(g.id, e)} className="hidden" disabled={uploadingGroupAvatarId === g.id} />
                  </label>

                  <div className="min-w-0 pr-2">
                    <h4 className="font-bold text-base mb-1 truncate">{g.name}</h4>
                    <div className="flex -space-x-1.5">
                      {g.group_members?.map((member, idx) => {
                        const prof = member.profiles;
                        const initialStr = getInitials(prof.first_name, prof.last_name);
                        return (
                          <div key={idx} className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black text-white border-2 border-card relative z-[10] overflow-hidden"
                            style={{ background: prof.avatar_url ? 'transparent' : getColor(prof.first_name || prof.id), zIndex: 20 - idx }}>
                            {prof.avatar_url ? (
                              <img src={prof.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              initialStr
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[9px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">
                      Code: {g.share_code || "Private Link"}
                    </p>
                  </div>
                </div>

                {g.share_code && (
                  <button type="button" onClick={() => handleCopy(g.share_code!)}
                    className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-secondary text-muted-foreground active:scale-95 transition-transform hover:text-foreground">
                    {copiedCode === g.share_code ? <Icon icon="solar:check-read-linear" className="size-5 text-emerald-500" /> : <Icon icon="solar:copy-linear" className="size-5" />}
                  </button>
                )}
              </div>
            ))}
            
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 bg-secondary/50 rounded-2xl border border-dashed border-border">You aren't in any groups yet.</p>
            )}
          </div>
        </div>

        {/* Join / Create */}
        <div className="border-t border-border/50 pt-8 mb-10">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Join a Cravelist</p>
          <div className="flex gap-3 mb-6">
            <div className="flex-1 bg-input rounded-2xl border border-transparent focus-within:border-primary/30 transition-all">
              <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={6}
                placeholder="ENTER 6-DIGIT CODE" 
                className="w-full bg-transparent px-4 py-4 text-sm font-bold uppercase placeholder:text-muted-foreground/50 outline-none" 
              />
            </div>
            <button disabled={joining || joinCode.length < 6} onClick={handleJoin}
              className="px-8 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50">
              {joining ? "..." : "Join"}
            </button>
          </div>

          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Create New Cravelist</p>
          <div className="flex gap-3">
            <div className="flex-1 bg-input rounded-2xl border border-transparent focus-within:border-primary/30 transition-all">
              <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="EX: NYC TRIP 2026" 
                className="w-full bg-transparent px-4 py-4 text-sm font-bold uppercase placeholder:text-muted-foreground/50 outline-none" 
              />
            </div>
            <button disabled={creating || newGroupName.length < 3} onClick={handleCreate}
              className="px-8 bg-foreground text-background rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50">
              {creating ? "..." : "Create"}
            </button>
          </div>
        </div>

        {/* Sign Out & Delete */}
        <div className="space-y-3">
          <button type="button" onClick={handleSignOut}
            className="w-full py-4 font-bold text-sm bg-secondary text-foreground rounded-2xl hover:bg-secondary/80 transition-colors">
            Sign Out
          </button>
          <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}
            className="w-full py-4 text-destructive font-bold text-sm bg-destructive/5 rounded-2xl hover:bg-destructive/10 transition-colors">
            {deleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>

      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/80 backdrop-blur-sm transition-opacity animate-in fade-in">
          <div className="bg-card w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-border/50 scale-100 transition-transform animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4 mx-auto">
              <Icon icon="solar:trash-bin-trash-bold" className="text-destructive size-8" />
            </div>
            <h3 className="text-xl font-heading font-black text-center mb-2">Delete Account?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
              Are you sure you want to completely delete your account? This will permanently wipe all your cravelists, reviews, and data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3.5 rounded-2xl font-bold text-foreground bg-secondary active:scale-95 transition-all">
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="flex-1 py-3.5 rounded-2xl font-bold text-destructive-foreground bg-destructive shadow-lg shadow-destructive/20 active:scale-95 transition-all">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorModalMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/80 backdrop-blur-sm transition-opacity animate-in fade-in">
          <div className="bg-card w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border border-border/50 scale-100 transition-transform animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4 mx-auto">
              <Icon icon="solar:danger-triangle-bold" className="text-destructive size-8" />
            </div>
            <h3 className="text-xl font-heading font-black text-center mb-2">Oops!</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
              {errorModalMsg}
            </p>
            <button onClick={() => setErrorModalMsg(null)}
              className="w-full py-3.5 rounded-2xl font-bold text-foreground bg-secondary active:scale-95 transition-all">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
