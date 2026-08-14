import { useState, useEffect } from "react";
import { User, LogOut, Copy, Check, Users, Plus, Camera, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { C } from "../constants/theme";
import { Group, Profile } from "../types";

const getColor = (str: string) => {
  const colors = [C.rose, C.amber, C.emerald, "#06b6d4", "#8B5CF6", "#F43F5E", "#EAB308"];
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
      loadData(); // Re-fetch all data to ensure groups represent the updated photo identically
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const [uploadingGroupAvatarId, setUploadingGroupAvatarId] = useState<string | null>(null);

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
      alert(err.message);
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
    if (joinCode.length < 6) return alert("Code must be at least 6 characters.");
    setJoining(true);
    const { error } = await supabase.rpc("join_group", { invite_code: joinCode.toUpperCase() });
    setJoining(false);
    if (error) alert(error.message);
    else { setJoinCode(""); loadData(); }
  };

  const handleCreate = async () => {
    if (newGroupName.length < 3) return alert("Name too short.");
    setCreating(true);
    const { error } = await supabase.rpc("create_group", { group_name: newGroupName });
    setCreating(false);
    if (error) alert(error.message);
    else { setNewGroupName(""); loadData(); }
  };

  const handleSignOut = async () => {
    queryClient.clear();
    await supabase.auth.signOut();
  };

  const handleDeleteAccountClick = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    const { error } = await supabase.rpc("delete_user_account");
    
    if (error) {
      alert(error.message);
      setDeleting(false);
    } else {
      // Clear cache and sign out automatically on success
      await handleSignOut();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 bg-slate-50 flex flex-col items-center">
      <div className="w-full max-w-sm mt-4">

        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col items-center mb-6">
          <div className="mb-4">
            <label className="relative group w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer overflow-hidden border-4 border-white shadow-md transition-all active:scale-95">
              {uploadingAvatar ? (
                <div className="animate-spin w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full" />
              ) : profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-slate-300" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <Camera size={24} className="text-white" />
              </div>
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingAvatar} />
            </label>
          </div>
          <h2 className="text-xl font-black text-slate-800">
            {profile?.first_name ? `Hi, ${profile.first_name}!` : "My Profile"}
          </h2>
        </div>

        {/* Workspaces List */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} style={{ color: C.rose }} />
            <h3 className="font-black text-slate-800">My Cravelists</h3>
          </div>

          <div className="space-y-3 mb-6">
            {groups.map(g => (
              <div key={g.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
                
                {/* Editable Group Avatar */}
                <label className="relative group w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden shadow-sm flex-shrink-0 transition-all active:scale-95" style={!g.avatar_url ? { background: getColor(g.name) } : {}}>
                  {uploadingGroupAvatarId === g.id ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : g.avatar_url ? (
                    <img src={g.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[14px] font-black tracking-wider text-white">
                      {getInitials(g.name, null).replace("?", "✨")}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <Camera size={14} className="text-white" />
                  </div>
                  <input type="file" accept="image/*" onChange={(e) => handleGroupAvatarUpload(g.id, e)} className="hidden" disabled={uploadingGroupAvatarId === g.id} />
                </label>

                <div className="flex-1 min-w-0 pr-2">
                  <p className="font-bold text-slate-800 truncate leading-tight">{g.name}</p>
                  
                  {/* Overlapping Squad Avatars */}
                  <div className="flex items-center -space-x-1.5 mt-1.5 mb-1">
                    {g.group_members?.map((member, idx) => {
                      const prof = member.profiles;
                      const initialStr = getInitials(prof.first_name, prof.last_name);
                      return (
                        <div key={idx} className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black tracking-tighter text-white border-2 border-slate-50 shadow-sm relative z-[10] overflow-hidden"
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

                  <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">Code: <span className="font-mono text-slate-500">{g.share_code || "Private Link"}</span></p>
                </div>
                {g.share_code && (
                  <button type="button" onClick={() => handleCopy(g.share_code!)}
                    className="w-9 h-9 flex-shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-300 transition-all">
                    {copiedCode === g.share_code ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                )}
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">You aren't in any groups yet.</p>
            )}
          </div>

          <div className="border-t border-slate-100 pt-5">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Join a Cravelist</p>
            <div className="flex gap-2 mb-6">
              <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="ENTER 6-DIGIT CODE" maxLength={6}
                className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 font-mono uppercase text-sm outline-none focus:border-rose-400 focus:bg-white transition-all min-w-0" />
              <button disabled={joining || joinCode.length < 6} onClick={handleJoin}
                className="px-5 rounded-xl font-bold text-white text-sm disabled:opacity-50 active:scale-95 transition-all shadow-md flex-shrink-0"
                style={{ background: C.rose }}>
                {joining ? "..." : "Join"}
              </button>
            </div>

            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Create New Cravelist</p>
            <div className="flex gap-2">
              <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Ex: NYC Trip 2026"
                className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 text-sm outline-none focus:border-rose-400 focus:bg-white transition-all min-w-0" />
              <button disabled={creating || newGroupName.length < 3} onClick={handleCreate}
                className="px-4 rounded-xl font-bold text-slate-600 bg-slate-200 active:scale-95 disabled:opacity-50 flex items-center gap-1 transition-all flex-shrink-0">
                <Plus size={16} /> New
              </button>
            </div>
          </div>
        </div>

        {/* Sign Out & Delete */}
        <div className="space-y-3 mb-6">
          <button type="button" onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-slate-500 active:bg-slate-200 transition-all border border-slate-200 bg-white shadow-sm">
            <LogOut size={16} /> Sign Out
          </button>
          
          <button type="button" onClick={handleDeleteAccountClick} disabled={deleting}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-rose-500 active:bg-rose-50 transition-all border border-rose-100 bg-white shadow-sm disabled:opacity-50">
            <Trash2 size={16} /> {deleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>

      </div>

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl scale-100 transition-transform">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} className="text-rose-500" />
            </div>
            <h3 className="text-xl font-black text-slate-800 text-center mb-2">Delete Account?</h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              Are you sure you want to completely delete your account? This will permanently wipe all your cravelists, reviews, and data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3.5 rounded-2xl font-bold text-slate-600 bg-slate-100 active:bg-slate-200 transition-all">
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-rose-500 shadow-md shadow-rose-200 active:scale-95 transition-all">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
